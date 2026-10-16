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

    @PostMapping(consumes = {"multipart/form-data"})
    public ResponseEntity<Post> createPostWithImages(
            @RequestPart("post") Post post,
            @RequestPart(value = "images", required = false) MultipartFile[] images) {
        
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