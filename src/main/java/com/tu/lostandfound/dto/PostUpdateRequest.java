package com.tu.lostandfound.dto;

import com.tu.lostandfound.model.Post;

public record PostUpdateRequest(
        String title,
        String description,
        String location,
        String contactName,
        String contactInfo,
        Post.ContactType contactType) {}
