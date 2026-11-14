package com.tu.lostandfound.service;

import com.tu.lostandfound.dto.ClaimCreateRequestDto;
import com.tu.lostandfound.dto.ClaimResponseDto;
import com.tu.lostandfound.exception.ApiException;
import com.tu.lostandfound.model.Claim;
import com.tu.lostandfound.model.ClaimImage;
import com.tu.lostandfound.model.Post;
import com.tu.lostandfound.repository.ClaimImageRepository;
import com.tu.lostandfound.repository.ClaimRepository;
import com.tu.lostandfound.repository.PostRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

@Service
public class ClaimService {
    private final ClaimRepository claimRepository;
    private final ClaimImageRepository claimImageRepository;
    private final PostRepository postRepository;
    private final UploadService uploadService;

    public ClaimService(ClaimRepository claimRepository,
                        ClaimImageRepository claimImageRepository,
                        PostRepository postRepository,
                        UploadService uploadService) {
        this.claimRepository = claimRepository;
        this.claimImageRepository = claimImageRepository;
        this.postRepository = postRepository;
        this.uploadService = uploadService;
    }

    @Transactional
    public ClaimResponseDto create(Long postId, ClaimCreateRequestDto request,
                                   MultipartFile[] photos, String employeeId) {
        Post post = getPost(postId);
        if (employeeId.equals(post.getAuthorEmail())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "เจ้าของโพสต์ไม่สามารถส่งคำขอรับของตัวเองได้");
        }
        if (post.getStatus() != Post.PostStatus.pending_review && post.getStatus() != Post.PostStatus.published) {
            throw new ApiException(HttpStatus.CONFLICT, "โพสต์นี้ไม่เปิดรับคำขอแล้ว");
        }
        if (request == null || blank(request.contactName()) || blank(request.contactInfo())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "กรุณากรอกชื่อและช่องทางติดต่อ");
        }

        List<MultipartFile> validPhotos = uploadService.validate(photos, 2);
        if (validPhotos.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "กรุณาแนบรูปภาพยืนยันอย่างน้อย 1 รูป");
        }

        Claim claim = new Claim();
        claim.setPost(post);
        claim.setContactName(request.contactName().trim());
        claim.setContactInfo(request.contactInfo().trim());
        claim.setRequesterEmployeeId(employeeId);
        List<Path> savedFiles = new ArrayList<>();
        try {
            claim = claimRepository.save(claim);
            for (MultipartFile photo : validPhotos) {
                Path path = uploadService.save(photo);
                savedFiles.add(path);
                ClaimImage image = new ClaimImage();
                image.setClaim(claim);
                image.setImageUrl(uploadService.urlOf(path));
                claim.getImages().add(image);
                claimImageRepository.save(image);
            }
            return toDto(claim);
        } catch (IOException e) {
            uploadService.deleteQuietly(savedFiles);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "บันทึกรูปคำขอไม่สำเร็จ");
        } catch (RuntimeException e) {
            uploadService.deleteQuietly(savedFiles);
            throw e;
        }
    }

    @Transactional(readOnly = true)
    public List<ClaimResponseDto> listForPost(Long postId, String employeeId) {
        Post post = getPost(postId);
        requireOwner(post, employeeId);
        return claimRepository.findByPostIdOrderByCreatedAtDesc(postId).stream()
                .map(this::toDto).toList();
    }

    @Transactional
    public void confirm(Long claimId, String employeeId) {
        Claim claim = getClaim(claimId);
        Post post = claim.getPost();
        requireOwner(post, employeeId);
        if (claim.getStatus() != Claim.ClaimStatus.pending ||
                (post.getStatus() != Post.PostStatus.pending_review && post.getStatus() != Post.PostStatus.published)) {
            throw new ApiException(HttpStatus.CONFLICT, "คำขอนี้หรือโพสต์ไม่ได้อยู่ในสถานะที่ยืนยันได้");
        }
        claim.setStatus(Claim.ClaimStatus.confirmed);
        post.setStatus(Post.PostStatus.returned);
    }

    @Transactional
    public void reject(Long claimId, String employeeId) {
        Claim claim = getClaim(claimId);
        requireOwner(claim.getPost(), employeeId);
        if (claim.getStatus() != Claim.ClaimStatus.pending) {
            throw new ApiException(HttpStatus.CONFLICT, "คำขอนี้ไม่ได้อยู่ในสถานะ pending แล้ว");
        }
        claim.setStatus(Claim.ClaimStatus.rejected);
    }

    @Transactional
    public void deleteForPost(Long postId) {
        List<Claim> claims = claimRepository.findByPostIdOrderByCreatedAtDesc(postId);
        List<Path> files = new ArrayList<>();
        List<ClaimImage> images = new ArrayList<>();
        for (Claim claim : claims) {
            images.addAll(claim.getImages());
            claim.getImages().forEach(image -> files.add(uploadService.pathOf(image.getImageUrl())));
        }
        claimImageRepository.deleteAll(images);
        claimImageRepository.flush();
        claimRepository.deleteAll(claims);
        claimRepository.flush();
        uploadService.deleteQuietly(files);
    }

    private ClaimResponseDto toDto(Claim claim) {
        return new ClaimResponseDto(claim.getId(), claim.getContactName(), claim.getContactInfo(),
                claim.getStatus(), claim.getCreatedAt(),
                claim.getImages().stream().map(ClaimImage::getImageUrl).toList());
    }

    private Post getPost(Long id) {
        return postRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ไม่พบโพสต์นี้"));
    }

    private Claim getClaim(Long id) {
        return claimRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ไม่พบคำขอนี้"));
    }

    private void requireOwner(Post post, String employeeId) {
        if (!employeeId.equals(post.getAuthorEmail())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "เฉพาะเจ้าของโพสต์เท่านั้นที่ทำรายการนี้ได้");
        }
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
}
