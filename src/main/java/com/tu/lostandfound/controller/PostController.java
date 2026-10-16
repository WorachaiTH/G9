package com.tu.lostandfound.controller;

import com.tu.lostandfound.model.Post;
import com.tu.lostandfound.model.PostImage;
import com.tu.lostandfound.repository.PostRepository;
import com.tu.lostandfound.repository.PostImageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/posts")
@CrossOrigin(origins = "*")
public class PostController {

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private PostImageRepository postImageRepository;

    private static final String UPLOAD_DIR = "uploads/";
    private static final long MAX_FILE_SIZE = 5 * 1024 * 1024;

    @PostMapping(consumes = {"multipart/form-data"})
    public ResponseEntity<?> createPostWithImages(
            @RequestPart("post") Post post,
            @RequestPart(value = "images", required = false) MultipartFile[] images) {
        
        if (post.getTitle() == null || post.getTitle().trim().isEmpty() ||
            post.getLocation() == null || post.getLocation().trim().isEmpty() ||
            post.getContactInfo() == null || post.getContactInfo().trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Error: กรุณากรอกข้อมูลจำเป็นให้ครบถ้วน");
        }

        if (images != null && images.length > 0) {
            for (MultipartFile file : images) {
                if (file.getSize() > MAX_FILE_SIZE) {
                    return ResponseEntity.badRequest().body("Error: ขนาดไฟล์รูปภาพเกินกำหนด (สูงสุด 5MB)");
                }
                String contentType = file.getContentType();
                if (contentType == null || (!contentType.equals("image/jpeg") && !contentType.equals("image/png") && !contentType.equals("image/jpg"))) {
                    return ResponseEntity.badRequest().body("Error: รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG) เท่านั้น");
                }
            }
        }

        Post savedPost = postRepository.save(post);

        if (images != null && images.length > 0) {
            File uploadDir = new File(UPLOAD_DIR);
            if (!uploadDir.exists()) {
                uploadDir.mkdir();
            }

            for (int i = 0; i < images.length; i++) {
                MultipartFile file = images[i];
                try {
                    String fileName = UUID.randomUUID().toString() + "_" + file.getOriginalFilename();
                    Path filePath = Paths.get(UPLOAD_DIR + fileName);
                    
                    Files.write(filePath, file.getBytes());

                    PostImage postImage = new PostImage();
                    postImage.setImageUrl("/uploads/" + fileName);
                    postImage.setDisplayOrder(i + 1);
                    postImage.setPost(savedPost);

                    postImageRepository.save(postImage);

                } catch (IOException e) {
                    e.printStackTrace();
                }
            }
        }

        return ResponseEntity.ok(savedPost);
    }

    @GetMapping
    public List<Post> getAllPosts(@RequestParam(required = false) Post.PostType type) {
        if (type != null) {
            return postRepository.findByType(type);
        }
        return postRepository.findAll();
    }
}