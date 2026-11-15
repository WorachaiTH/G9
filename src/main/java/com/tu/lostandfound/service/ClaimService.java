package com.tu.lostandfound.service;

import com.tu.lostandfound.dto.ClaimDto;
import com.tu.lostandfound.dto.ClaimRequest;
import com.tu.lostandfound.dto.PostDto;
import com.tu.lostandfound.exception.ApiException;
import com.tu.lostandfound.model.Claim;
import com.tu.lostandfound.model.ClaimImage;
import com.tu.lostandfound.model.Post;
import com.tu.lostandfound.repository.ClaimRepository;
import com.tu.lostandfound.repository.PostRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
public class ClaimService {

    static final Set<Post.PostStatus> CLAIMABLE_STATUSES = Set.of(
            Post.PostStatus.published,
            Post.PostStatus.pending_review);

    private final ClaimRepository claimRepository;
    private final PostRepository postRepository;
    private final UploadService uploadService;

    public ClaimService(ClaimRepository claimRepository,
                        PostRepository postRepository,
                        UploadService uploadService) {
        this.claimRepository = claimRepository;
        this.postRepository = postRepository;
        this.uploadService = uploadService;
    }

    @Transactional
    public ClaimDto submit(Long postId, String employeeId, ClaimRequest request, MultipartFile[] photos) {
        Post post = postRepository.findByIdForUpdate(postId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ไม่พบโพสต์นี้"));

        if (employeeId.equals(post.getAuthorEmail())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "เจ้าของโพสต์ขอรับของตัวเองไม่ได้");
        }
        if (post.getType() != Post.PostType.found) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ขอรับได้เฉพาะโพสต์ของที่พบเท่านั้น");
        }
        if (!CLAIMABLE_STATUSES.contains(post.getStatus())) {
            throw new ApiException(HttpStatus.CONFLICT, "โพสต์นี้มีคำขออยู่แล้วหรือปิดไปแล้ว");
        }

        String contactName = request == null ? null : trimToNull(request.contactName());
        String contactInfo = request == null ? null : trimToNull(request.contactInfo());
        if (contactName == null || contactInfo == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "กรุณากรอกชื่อและช่องทางติดต่อ");
        }
        if (contactName.length() > 100 || contactInfo.length() > 255) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "ชื่อหรือช่องทางติดต่อยาวเกินกำหนด");
        }

        List<MultipartFile> validPhotos = uploadService.validate(
                photos, UploadService.MAX_CLAIM_IMAGES, UploadService.CLAIM_IMAGE_TYPES);
        if (validPhotos.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "กรุณาแนบรูปภาพยืนยันอย่างน้อย 1 รูป");
        }

        Claim claim = new Claim();
        claim.setPost(post);
        claim.setClaimantId(employeeId);
        claim.setContactName(contactName);
        claim.setContactInfo(contactInfo);
        claim.setStatus(Claim.ClaimStatus.pending);

        List<Path> savedFiles = new ArrayList<>();
        uploadService.deleteOnRollback(savedFiles);
        try {
            int order = 1;
            for (MultipartFile file : validPhotos) {
                Path target = uploadService.save(file);
                savedFiles.add(target);

                ClaimImage image = new ClaimImage();
                image.setImageUrl(uploadService.urlOf(target));
                image.setMimeType(file.getContentType());
                image.setSizeBytes((int) file.getSize());
                image.setSortOrder((short) order++);
                claim.addImage(image);
            }
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "บันทึกรูปภาพไม่สำเร็จ");
        }

        Claim saved = claimRepository.save(claim);
        post.setStatus(Post.PostStatus.claimed);
        postRepository.save(post);

        return ClaimDto.from(saved);
    }

    @Transactional(readOnly = true)
    public List<ClaimDto> listForOwner(Long postId, String employeeId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ไม่พบโพสต์นี้"));
        requireOwner(post, employeeId);

        return claimRepository.findByPostIdOrderByCreatedAtDesc(postId).stream()
                .map(ClaimDto::from)
                .toList();
    }

    @Transactional
    public PostDto confirm(Long claimId, String employeeId) {
        Claim claim = findClaim(claimId);
        Post post = lockPostOf(claim);
        requireOwner(post, employeeId);
        requirePending(claim, post);

        claim.setStatus(Claim.ClaimStatus.confirmed);
        post.setStatus(Post.PostStatus.returned);
        post.setGrantedAt(LocalDateTime.now());
        claimRepository.save(claim);
        postRepository.save(post);

        return PostDto.from(post, employeeId);
    }

    @Transactional
    public ClaimDto reject(Long claimId, String employeeId) {
        Claim claim = findClaim(claimId);
        Post post = lockPostOf(claim);
        requireOwner(post, employeeId);
        requirePending(claim, post);

        claim.setStatus(Claim.ClaimStatus.rejected);
        post.setStatus(Post.PostStatus.published);
        claimRepository.save(claim);
        postRepository.save(post);

        return ClaimDto.from(claim);
    }

    private Claim findClaim(Long claimId) {
        return claimRepository.findById(claimId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ไม่พบคำขอนี้"));
    }

    private Post lockPostOf(Claim claim) {
        return postRepository.findByIdForUpdate(claim.getPost().getId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ไม่พบโพสต์นี้"));
    }

    private static void requireOwner(Post post, String employeeId) {
        if (!employeeId.equals(post.getAuthorEmail())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "เฉพาะเจ้าของโพสต์เท่านั้น");
        }
    }

    private static void requirePending(Claim claim, Post post) {
        if (claim.getStatus() != Claim.ClaimStatus.pending || post.getStatus() != Post.PostStatus.claimed) {
            throw new ApiException(HttpStatus.CONFLICT, "คำขอนี้ไม่ได้อยู่ในสถานะรอยืนยันแล้ว");
        }
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
