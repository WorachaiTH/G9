package com.tu.lostandfound.service;

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

@Service
public class PostService {

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

    public List<Post> list(Post.PostStatus status) {
        if (status != null) {
            return postRepository.findByStatusOrderByCreatedAtDesc(status);
        }
        return postRepository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public Post create(Post post, MultipartFile[] images, String employeeId) {
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
            return savedPost;

        } catch (IOException e) {
            uploadService.deleteQuietly(savedFiles);
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "บันทึกรูปภาพไม่สำเร็จ");
        } catch (RuntimeException e) {
            uploadService.deleteQuietly(savedFiles);
            throw e; // ให้ transaction rollback และเห็น error ใน console
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
