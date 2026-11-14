package com.tu.lostandfound.controller;

import com.tu.lostandfound.exception.ApiException;
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

        String employeeId = requireEmployeeId(authorization, "กรุณาเข้าสู่ระบบก่อนโพสต์");
        PostResponseDto savedPost = postService.create(post, images, employeeId);
        return ResponseEntity.status(HttpStatus.CREATED).body(savedPost);
    }

    @GetMapping
    public List<PostResponseDto> getAllPosts(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam(required = false) Post.PostStatus status,
            @RequestParam(required = false) Post.PostType type,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) String keyword) {
        return postService.list(status, type, location, keyword, employeeIdIfValid(authorization));
    }

    @GetMapping("/mine")
    public List<PostResponseDto> getMyPosts(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return postService.mine(requireEmployeeId(authorization, "กรุณาเข้าสู่ระบบเพื่อดูโพสต์ของคุณ"));
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PostResponseDto updatePost(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @RequestPart("request") PostUpdateRequestDto request,
            @RequestPart(value = "newImages", required = false) MultipartFile[] newImages,
            @RequestParam(value = "removeImageIds", required = false) List<Long> removeImageIds) {
        String employeeId = requireEmployeeId(authorization, "กรุณาเข้าสู่ระบบก่อนแก้ไขโพสต์");
        return postService.update(id, request, newImages, removeImageIds, employeeId);
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

    private String employeeIdIfValid(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) return null;
        return jwtService.parseEmployeeId(authorization.substring(7));
    }
}
