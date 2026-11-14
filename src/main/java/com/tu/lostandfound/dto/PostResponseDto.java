package com.tu.lostandfound.dto;

import com.tu.lostandfound.model.Post;
import com.tu.lostandfound.model.PostImage;

import java.time.LocalDateTime;
import java.util.List;

public record PostResponseDto(
        Long id,
        Post.PostType type,
        String title,
        String status,
        String authorEmail,
        boolean owner,
        String description,
        String location,
        String contactName,
        String contactInfo,
        LocalDateTime createdAt,
        List<ImageDto> images) {

    public static PostResponseDto from(Post post, List<PostImage> images, boolean owner) {
        String frontendStatus = post.getStatus() == null ? "open" : switch (post.getStatus()) {
            case pending_review, claimed -> "pending";
            case returned -> "granted";
            default -> post.getStatus().name();
        };
        return new PostResponseDto(
                post.getId(), post.getType(), post.getTitle(), frontendStatus,
                post.getAuthorEmail(), owner, post.getDescription(), post.getLocation(),
                post.getContactName(), post.getContactInfo(), post.getCreatedAt(),
                images.stream().map(image -> new ImageDto(image.getId(), image.getImageUrl())).toList());
    }

    public record ImageDto(Long id, String imageUrl) {}
}
