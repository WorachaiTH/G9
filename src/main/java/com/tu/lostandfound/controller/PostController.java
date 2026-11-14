package com.tu.lostandfound.controller;

import com.tu.lostandfound.dto.PostResponseDto;
import com.tu.lostandfound.dto.PostUpdateRequestDto;
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
    public ResponseEntity<PostResponseDto> createPost(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestPart("post") Post post,
            @RequestPart(value = "images", required = false) MultipartFile[] images) {
        String employeeId = jwtService.requireEmployeeId(authorization, "Please sign in before creating a post");
        PostResponseDto savedPost = postService.create(post, images, employeeId);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedPost);
    }

    @GetMapping
    public List<PostResponseDto> getAllPosts(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) Post.PostStatus status,
            @RequestParam(required = false) Post.PostType type,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String q) {
        String searchTerm = keyword != null ? keyword : q;
        return postService.list(status, type, location, searchTerm,
                jwtService.employeeIdFromHeader(authorization));
    }

    @GetMapping("/mine")
    public List<PostResponseDto> getMyPosts(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        String employeeId = jwtService.requireEmployeeId(authorization, "Please sign in to view your posts");
        return postService.mine(employeeId);
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PostResponseDto updatePost(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @RequestPart("request") PostUpdateRequestDto request,
            @RequestPart(value = "newImages", required = false) MultipartFile[] newImages,
            @RequestParam(value = "removeImageIds", required = false) List<Long> removeImageIds) {
        String employeeId = jwtService.requireEmployeeId(authorization, "Please sign in before editing a post");
        return postService.update(id, request, newImages, removeImageIds, employeeId);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePost(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id) {
        String employeeId = jwtService.requireEmployeeId(authorization, "Please sign in before deleting a post");
        postService.delete(id, employeeId);
        return ResponseEntity.noContent().build();
    }
}
