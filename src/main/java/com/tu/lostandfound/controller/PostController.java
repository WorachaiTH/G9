package com.tu.lostandfound.controller;

import com.tu.lostandfound.exception.ApiException;
import com.tu.lostandfound.model.Post;
import com.tu.lostandfound.security.JwtService;
import com.tu.lostandfound.service.PostService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/posts")
@CrossOrigin(origins = "*")
public class PostController {

    private final PostService postService;
    private final JwtService jwtService;

    public PostController(PostService postService, JwtService jwtService) {
        this.postService = postService;
        this.jwtService = jwtService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Post> createPost(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestPart("post") Post post,
            @RequestPart(value = "images", required = false) MultipartFile[] images) {

        String employeeId = requireEmployeeId(authorization, "กรุณาเข้าสู่ระบบก่อนโพสต์");
        Post savedPost = postService.create(post, images, employeeId);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedPost);
    }

    @GetMapping
    public List<Post> getAllPosts(@RequestParam(required = false) Post.PostStatus status) {
        return postService.list(status);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePost(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id) {

        String employeeId = requireEmployeeId(authorization, "กรุณาเข้าสู่ระบบก่อนลบโพสต์");
        postService.delete(id, employeeId);
        return ResponseEntity.noContent().build();
    }

    private String requireEmployeeId(String authorization, String message) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, message);
        }
        String employeeId = jwtService.parseEmployeeId(authorization.substring(7));
        if (employeeId == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, message);
        }
        return employeeId;
    }
}
