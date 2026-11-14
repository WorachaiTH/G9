package com.tu.lostandfound.dto;

import com.tu.lostandfound.model.Post;

public record PostUpdateRequestDto(
        Post.PostType type,
        String title,
        String description,
        String location,
        String contactName,
        String contactInfo) {}
