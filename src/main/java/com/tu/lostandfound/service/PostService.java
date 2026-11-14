package com.tu.lostandfound.service;

import com.tu.lostandfound.exception.ApiException;
import com.tu.lostandfound.dto.PostResponseDto;
import com.tu.lostandfound.dto.PostUpdateRequestDto;
import com.tu.lostandfound.model.Post;
import com.tu.lostandfound.model.PostImage;
import com.tu.lostandfound.repository.PostImageRepository;
import com.tu.lostandfound.repository.PostRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.HashSet;

@Service
public class PostService {

    private final PostRepository postRepository;
    private final PostImageRepository postImageRepository;
    private final UploadService uploadService;
    private final ClaimService claimService;

    public PostService(PostRepository postRepository,
                       PostImageRepository postImageRepository,
                       UploadService uploadService,
                       ClaimService claimService) {
        this.postRepository = postRepository;
        this.postImageRepository = postImageRepository;
        this.uploadService = uploadService;
        this.claimService = claimService;
    }

    @Transactional(readOnly = true)
    public List<PostResponseDto> list(Post.PostStatus status, Post.PostType type,
                                     String location, String keyword, String viewerEmployeeId) {
        return postRepository.search(status, type, blankToNull(location), blankToNull(keyword)).stream()
                .map(post -> toDto(post, viewerEmployeeId)).toList();
    }

    @Transactional(readOnly = true)
    public List<PostResponseDto> mine(String employeeId) {
        return postRepository.findByAuthorEmailOrderByCreatedAtDesc(employeeId).stream()
                .map(post -> toDto(post, employeeId)).toList();
    }

    @Transactional
    public PostResponseDto create(Post post, MultipartFile[] images, String employeeId) {
        if (isBlank(post.getLocation()) || isBlank(post.getContactInfo())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "กรุณากรอกสถานที่และช่องทางติดต่อ");
        }

        // title / description ห้ามว่าง (DB บังคับ NOT NULL)
        if (isBlank(post.getTitle()) && isBlank(post.getDescription())) {
            post.setTitle("รายการของหาย/พบของ");
            post.setDescription(post.getTitle());
        } else if (isBlank(post.getTitle())) {
            post.setTitle(post.getDescription());
        } else if (isBlank(post.getDescription())) {
            post.setDescription(post.getTitle());
        }

        // title ยาวเกิน 255 ตัวอักษรจะบันทึกไม่ได้
        if (post.getTitle().length() > 255) {
            post.setTitle(post.getTitle().substring(0, 255));
        }

        // ไม่เชื่อค่าที่ client ส่งมาในฟิลด์เหล่านี้
        post.setId(null);
        post.setAuthorEmail(employeeId);
        post.setStatus(Post.PostStatus.pending_review);
        if (post.getType() == null) {
            post.setType(Post.PostType.lost);
        }

        List<MultipartFile> validImages = uploadService.validate(images);
        if (post.getType() == Post.PostType.found && validImages.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "กรุณาแนบรูปภาพสำหรับโพสต์ของที่พบ");
        }

        List<Path> savedFiles = new ArrayList<>();
        try {
            Post savedPost = postRepository.save(post);

            int order = 1;
            for (MultipartFile file : validImages) {
                Path target = uploadService.save(file);
                savedFiles.add(target);

                PostImage postImage = new PostImage();
                postImage.setImageUrl(uploadService.urlOf(target));
                postImage.setMimeType(file.getContentType());
                postImage.setSizeBytes((int) file.getSize());
                postImage.setSortOrder((short) order++);
                postImage.setPost(savedPost);
                postImageRepository.save(postImage);
            }
            return toDto(savedPost, employeeId);

        } catch (IOException e) {
            uploadService.deleteQuietly(savedFiles);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "บันทึกรูปภาพไม่สำเร็จ");
        } catch (RuntimeException e) {
            uploadService.deleteQuietly(savedFiles);
            throw e; // ให้ transaction rollback และเห็น error ใน console
        }
    }

    @Transactional
    public PostResponseDto update(Long id, PostUpdateRequestDto request, MultipartFile[] newImages,
                                  List<Long> removeImageIds, String employeeId) {
        Post post = postRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ไม่พบโพสต์นี้"));
        if (!employeeId.equals(post.getAuthorEmail())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "แก้ไขได้เฉพาะโพสต์ของตัวเอง");
        }
        if (request == null || isBlank(request.description()) || isBlank(request.location()) ||
                isBlank(request.contactName()) || isBlank(request.contactInfo())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "กรุณากรอกรายละเอียด สถานที่ ชื่อ และช่องทางติดต่อให้ครบ");
        }

        List<PostImage> currentImages = postImageRepository.findByPostIdOrderBySortOrderAsc(id);
        Set<Long> requestedRemoval = removeImageIds == null ? Set.of() : new HashSet<>(removeImageIds);
        Set<Long> ownedImageIds = currentImages.stream().map(PostImage::getId).collect(java.util.stream.Collectors.toSet());
        if (!ownedImageIds.containsAll(requestedRemoval)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "พบ image id ที่ไม่ได้เป็นรูปของโพสต์นี้");
        }
        int remaining = currentImages.size() - requestedRemoval.size();
        List<MultipartFile> validNewImages = uploadService.validate(newImages, 5 - remaining);

        post.setType(request.type() == null ? post.getType() : request.type());
        String requestedTitle = isBlank(request.title()) ? request.description().trim() : request.title().trim();
        post.setTitle(limit(requestedTitle, 255));
        post.setDescription(request.description().trim());
        post.setLocation(request.location().trim());
        post.setContactName(request.contactName().trim());
        post.setContactInfo(request.contactInfo().trim());

        List<Path> filesToDelete = new ArrayList<>();
        List<PostImage> imagesToRemove = currentImages.stream()
                .filter(image -> requestedRemoval.contains(image.getId())).toList();
        List<PostImage> imagesToKeep = currentImages.stream()
                .filter(image -> !requestedRemoval.contains(image.getId())).toList();
        imagesToRemove.forEach(image -> filesToDelete.add(uploadService.pathOf(image.getImageUrl())));
        postImageRepository.deleteAll(imagesToRemove);

        List<Path> newFiles = new ArrayList<>();
        try {
            int order = 1;
            for (PostImage image : imagesToKeep) {
                image.setSortOrder((short) order++);
            }
            postImageRepository.saveAll(imagesToKeep);
            for (MultipartFile file : validNewImages) {
                Path path = uploadService.save(file);
                newFiles.add(path);
                PostImage image = new PostImage();
                image.setImageUrl(uploadService.urlOf(path));
                image.setMimeType(file.getContentType());
                image.setSizeBytes((int) file.getSize());
                image.setSortOrder((short) order++);
                image.setPost(post);
                postImageRepository.save(image);
            }
            Post saved = postRepository.save(post);
            postImageRepository.flush();
            uploadService.deleteQuietly(filesToDelete);
            return toDto(saved, employeeId);
        } catch (IOException e) {
            uploadService.deleteQuietly(newFiles);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "บันทึกรูปภาพไม่สำเร็จ");
        } catch (RuntimeException e) {
            uploadService.deleteQuietly(newFiles);
            throw e;
        }
    }

    @Transactional
    public void delete(Long id, String employeeId) {
        Post post = postRepository.findById(id)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "ไม่พบโพสต์นี้"));

        if (!employeeId.equals(post.getAuthorEmail())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ลบได้เฉพาะโพสต์ของตัวเอง");
        }

        claimService.deleteForPost(id);
        List<PostImage> images = postImageRepository.findByPostIdOrderBySortOrderAsc(id);
        List<Path> filesToDelete = new ArrayList<>();
        for (PostImage image : images) {
            filesToDelete.add(uploadService.pathOf(image.getImageUrl()));
        }

        postImageRepository.deleteAll(images);
        postImageRepository.flush();
        postRepository.delete(post);
        postRepository.flush();

        uploadService.deleteQuietly(filesToDelete);
    }

    private PostResponseDto toDto(Post post, String viewerEmployeeId) {
        boolean owner = viewerEmployeeId != null && viewerEmployeeId.equals(post.getAuthorEmail());
        return PostResponseDto.from(post,
                postImageRepository.findByPostIdOrderBySortOrderAsc(post.getId()), owner);
    }

    private static String blankToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }

    private static String limit(String value, int maxLength) {
        return value.length() > maxLength ? value.substring(0, maxLength) : value;
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
