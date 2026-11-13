package com.tu.lostandfound.service;

import com.tu.lostandfound.dto.PostDto;
import com.tu.lostandfound.exception.ApiException;
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
import java.util.Locale;
import java.util.Set;

@Service
public class PostService {

    public static final Set<Post.PostStatus> PUBLIC_STATUSES = Set.of(
            Post.PostStatus.pending_review,
            Post.PostStatus.published,
            Post.PostStatus.claimed);

    static final int MAX_KEYWORD_LENGTH = 100;

    private final PostRepository postRepository;
    private final PostImageRepository postImageRepository;
    private final UploadService uploadService;

    public PostService(PostRepository postRepository,
                       PostImageRepository postImageRepository,
                       UploadService uploadService) {
        this.postRepository = postRepository;
        this.postImageRepository = postImageRepository;
        this.uploadService = uploadService;
    }

    @Transactional(readOnly = true)
    public List<PostDto> search(String q, Post.PostStatus status, String viewerId) {
        Set<Post.PostStatus> statuses;
        if (status == null) {
            statuses = PUBLIC_STATUSES;
        } else if (PUBLIC_STATUSES.contains(status)) {
            statuses = Set.of(status);
        } else {
            return List.of();
        }

        String keyword = normalizeKeyword(q);
        List<Post> posts = keyword == null
                ? postRepository.findByStatusInOrderByCreatedAtDesc(statuses)
                : postRepository.searchByKeyword("%" + keyword + "%", statuses);

        return posts.stream().map(post -> PostDto.from(post, viewerId)).toList();
    }

    static String normalizeKeyword(String q) {
        if (q == null) return null;
        String cleaned = q.trim().replaceAll("\\s+", " ");
        if (cleaned.isEmpty()) return null;
        if (cleaned.length() > MAX_KEYWORD_LENGTH) {
            cleaned = cleaned.substring(0, MAX_KEYWORD_LENGTH);
        }
        return cleaned.toLowerCase(Locale.ROOT)
                .replace("!", "!!")
                .replace("%", "!%")
                .replace("_", "!_");
    }

    @Transactional
    public PostDto create(Post post, MultipartFile[] images, String employeeId) {
        if (isBlank(post.getLocation()) || isBlank(post.getContactInfo())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "กรุณากรอกสถานที่และช่องทางติดต่อ");
        }

        if (isBlank(post.getTitle()) && isBlank(post.getDescription())) {
            post.setTitle("รายการของหาย/พบของ");
            post.setDescription(post.getTitle());
        } else if (isBlank(post.getTitle())) {
            post.setTitle(post.getDescription());
        } else if (isBlank(post.getDescription())) {
            post.setDescription(post.getTitle());
        }

        if (post.getTitle().length() > 255) {
            post.setTitle(post.getTitle().substring(0, 255));
        }

        post.setId(null);
        post.getImages().clear();
        post.setAuthorEmail(employeeId);
        post.setStatus(Post.PostStatus.pending_review);
        if (post.getType() == null) {
            post.setType(Post.PostType.lost);
        }

        List<MultipartFile> validImages = uploadService.validate(images);

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
                savedPost.getImages().add(postImageRepository.save(postImage));
            }
            return PostDto.from(savedPost, employeeId);

        } catch (IOException e) {
            uploadService.deleteQuietly(savedFiles);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "บันทึกรูปภาพไม่สำเร็จ");
        } catch (RuntimeException e) {
            uploadService.deleteQuietly(savedFiles);
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

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
