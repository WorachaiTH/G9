package com.tu.lostandfound.controller;

import com.tu.lostandfound.model.Post;
import com.tu.lostandfound.model.PostImage;
import com.tu.lostandfound.repository.PostRepository;
import com.tu.lostandfound.repository.PostImageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

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
                uploadDir.mkdirs();
            }

            for (int i = 0; i < images.length; i++) {
                MultipartFile file = images[i];
                try {
                    String extension = "image/png".equals(file.getContentType()) ? ".png" : ".jpg";
                    String fileName = UUID.randomUUID() + extension;
                    Path filePath = Paths.get(UPLOAD_DIR).toAbsolutePath().normalize().resolve(fileName);
                    
                    Files.write(filePath, file.getBytes());

                    PostImage postImage = new PostImage();
                    postImage.setImageUrl("/api/posts/images/" + fileName);
                    postImage.setDisplayOrder(i + 1);
                    postImage.setPost(savedPost);

                    postImageRepository.save(postImage);
                    savedPost.getImageUrls().add(postImage.getImageUrl());

                } catch (IOException e) {
                    throw new ResponseStatusException(
                            HttpStatus.INTERNAL_SERVER_ERROR,
                            "Unable to save uploaded image",
                            e);
                }
            }
        }

        return ResponseEntity.ok(savedPost);
    }

    @GetMapping
    public List<Post> getAllPosts(@RequestParam(required = false) Post.PostType type) {
        List<Post> posts = type != null
                ? postRepository.findByType(type)
                : postRepository.findAll();
        posts.forEach(post -> post.setImageUrls(
                postImageRepository.findByPostIdOrderByDisplayOrderAsc(post.getId()).stream()
                        .map(PostImage::getImageUrl)
                        .collect(Collectors.toList())));
        return posts;
    }

    @GetMapping("/images/{fileName:.+}")
    public ResponseEntity<Resource> getImage(@PathVariable String fileName) {
        if (!fileName.matches("[a-f0-9-]{36}\\.(jpg|png)")) {
            return ResponseEntity.notFound().build();
        }

        Path uploadDirectory = Paths.get(UPLOAD_DIR).toAbsolutePath().normalize();
        Path imagePath = uploadDirectory.resolve(fileName).normalize();
        if (!imagePath.startsWith(uploadDirectory) || !Files.isRegularFile(imagePath)) {
            return ResponseEntity.notFound().build();
        }

        MediaType mediaType = fileName.endsWith(".png") ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG;
        return ResponseEntity.ok()
                .contentType(mediaType)
                .body(new FileSystemResource(imagePath));
    }
}