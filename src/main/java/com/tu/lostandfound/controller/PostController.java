package com.tu.lostandfound.controller;

import com.tu.lostandfound.dto.PostDto;
import com.tu.lostandfound.dto.PostUpdateRequest;
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
    public ResponseEntity<PostDto> createPost(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestPart("post") Post post,
            @RequestPart(value = "images", required = false) MultipartFile[] images) {

        String employeeId = jwtService.requireEmployeeId(authorization, "กรุณาเข้าสู่ระบบก่อนโพสต์");
        PostDto savedPost = postService.create(post, images, employeeId);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedPost);
    }

    @GetMapping
    public List<PostDto> getAllPosts(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Post.PostStatus status) {

        String viewerId = jwtService.employeeIdFromHeader(authorization);
        return postService.search(q, status, viewerId);
    }

    @GetMapping("/mine")
    public List<PostDto> getMyPosts(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Post.PostStatus status) {

        String employeeId = jwtService.requireEmployeeId(authorization, "กรุณาเข้าสู่ระบบก่อนดูโพสต์ของฉัน");
        return postService.listMine(employeeId, q, status);
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PostDto updatePost(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @RequestPart(value = "post", required = false) PostUpdateRequest request,
            @RequestPart(value = "newImages", required = false) MultipartFile[] newImages,
            @RequestParam(value = "removeImageIds", required = false) List<Long> removeImageIds) {

        String employeeId = jwtService.requireEmployeeId(authorization, "กรุณาเข้าสู่ระบบก่อนแก้ไขโพสต์");
        return postService.update(id, employeeId, request, newImages, removeImageIds);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePost(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id) {

        String employeeId = jwtService.requireEmployeeId(authorization, "กรุณาเข้าสู่ระบบก่อนลบโพสต์");
        postService.delete(id, employeeId);
        return ResponseEntity.noContent().build();
    }
}
