package com.tu.lostandfound.dto;

import com.tu.lostandfound.model.Post;

import java.time.LocalDateTime;
import java.util.List;

public record PostDto(
        Long id,
        Post.PostType type,
        String title,
        String description,
        String location,
        LocalDateTime dateTime,
        String contactName,
        String contactInfo,
        Post.ContactType contactType,
        Post.PostStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime grantedAt,
        List<ImageDto> images,
        boolean mine) {

    public record ImageDto(Long id, String imageUrl) {}

    public static PostDto from(Post post, String viewerId) {
        List<ImageDto> images = post.getImages().stream()
                .map(image -> new ImageDto(image.getId(), image.getImageUrl()))
                .toList();
        boolean mine = viewerId != null && viewerId.equals(post.getAuthorEmail());
        return new PostDto(
                post.getId(),
                post.getType(),
                post.getTitle(),
                post.getDescription(),
                post.getLocation(),
                post.getDateTime(),
                post.getContactName(),
                post.getContactInfo(),
                post.getContactType(),
                post.getStatus(),
                post.getCreatedAt(),
                post.getUpdatedAt(),
                post.getGrantedAt(),
                images,
                mine);
    }
}
