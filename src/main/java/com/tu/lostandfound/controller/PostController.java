package com.tu.lostandfound.controller;

import com.tu.lostandfound.model.Post;
import com.tu.lostandfound.repository.PostRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/posts")
@CrossOrigin(origins = "*")
public class PostController {

    @Autowired
    private PostRepository postRepository;

    @PostMapping
    public ResponseEntity<Post> createPost(@RequestBody Post post) {
        Post savedPost = postRepository.save(post);
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