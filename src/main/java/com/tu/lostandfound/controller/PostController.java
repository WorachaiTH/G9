package com.tu.lostandfound.controller;

import com.tu.lostandfound.model.Post;
import com.tu.lostandfound.model.PostImage;
import com.tu.lostandfound.repository.PostImageRepository;
import com.tu.lostandfound.repository.PostRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/posts")
@CrossOrigin(origins = "*")
public class PostController {

    private static final Path UPLOAD_PATH = Paths.get("uploads");
    private static final long MAX_FILE_SIZE = 5L * 1024 * 1024;
    private static final Map<String, String> ALLOWED_TYPES =
            Map.of("image/jpeg", ".jpg", "image/png", ".png");

    private final PostRepository postRepository;
    private final PostImageRepository postImageRepository;

    public PostController(PostRepository postRepository, PostImageRepository postImageRepository) {
        this.postRepository = postRepository;
        this.postImageRepository = postImageRepository;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Transactional
    public ResponseEntity<?> createPost(
            @RequestPart("post") Post post,
            @RequestPart(value = "images", required = false) MultipartFile[] images) {

        if (isBlank(post.getLocation()) || isBlank(post.getContactInfo())) {
            return ResponseEntity.badRequest().body("กรุณากรอกสถานที่และช่องทางติดต่อ");
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
        post.setStatus(Post.PostStatus.pending_review);
        if (post.getType() == null) {
            post.setType(Post.PostType.lost);
        }

        // ตรวจรูปก่อนบันทึกอะไรทั้งหมด
        List<MultipartFile> validImages = new ArrayList<>();
        if (images != null) {
            for (MultipartFile file : images) {
                if (file.isEmpty()) continue;
                if (file.getSize() > MAX_FILE_SIZE) {
                    return ResponseEntity.badRequest().body("ขนาดไฟล์รูปภาพเกินกำหนด (สูงสุด 5MB)");
                }
                String contentType = file.getContentType();
                if (contentType == null || !ALLOWED_TYPES.containsKey(contentType)) {
                    return ResponseEntity.badRequest().body("รองรับเฉพาะไฟล์รูปภาพ JPG, PNG เท่านั้น");
                }
                validImages.add(file);
            }
        }

        if (validImages.size() > 5) {
        return ResponseEntity.badRequest().body("แนบรูปได้สูงสุด 5 รูป");
        }

        List<Path> savedFiles = new ArrayList<>();
        try {
            Files.createDirectories(UPLOAD_PATH);
            Post savedPost = postRepository.save(post);

            int order = 1;
            for (MultipartFile file : validImages) {
                String fileName = UUID.randomUUID() + ALLOWED_TYPES.get(file.getContentType());
                Path target = UPLOAD_PATH.resolve(fileName);
                Files.copy(file.getInputStream(), target);
                savedFiles.add(target);

                PostImage postImage = new PostImage();
                postImage.setImageUrl("/uploads/" + fileName);
                postImage.setMimeType(file.getContentType());
                postImage.setSizeBytes((int) file.getSize());
                postImage.setSortOrder((short) order++);
                postImage.setPost(savedPost);
                postImageRepository.save(postImage);
            }
            return ResponseEntity.ok(savedPost);

        } catch (IOException e) {
            deleteFiles(savedFiles);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "บันทึกรูปภาพไม่สำเร็จ", e);
        } catch (RuntimeException e) {
            deleteFiles(savedFiles);
            throw e; // ให้ transaction rollback และเห็น error ใน console
        }
    }

        @GetMapping
    public List<Post> getAllPosts(@RequestParam(required = false) Post.PostStatus status) {
        if (status != null) {
            return postRepository.findByStatusOrderByCreatedAtDesc(status);
        }
        return postRepository.findAllByOrderByCreatedAtDesc();
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private static void deleteFiles(List<Path> files) {
        for (Path p : files) {
            try { Files.deleteIfExists(p); } catch (IOException ignored) {}
        }
    }
}