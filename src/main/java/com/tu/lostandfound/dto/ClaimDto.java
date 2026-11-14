package com.tu.lostandfound.dto;

import com.tu.lostandfound.model.Claim;
import com.tu.lostandfound.model.ClaimImage;

import java.time.LocalDateTime;
import java.util.List;

public record ClaimDto(
        Long id,
        Long postId,
        String claimantId,
        String contactName,
        String contactInfo,
        Claim.ClaimStatus status,
        LocalDateTime createdAt,
        List<String> imageUrls) {

    public static ClaimDto from(Claim claim) {
        return new ClaimDto(
                claim.getId(),
                claim.getPost().getId(),
                claim.getClaimantId(),
                claim.getContactName(),
                claim.getContactInfo(),
                claim.getStatus(),
                claim.getCreatedAt(),
                claim.getImages().stream().map(ClaimImage::getImageUrl).toList());
    }
}
