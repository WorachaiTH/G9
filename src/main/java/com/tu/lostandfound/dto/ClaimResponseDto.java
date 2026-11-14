package com.tu.lostandfound.dto;

import com.tu.lostandfound.model.Claim;

import java.time.LocalDateTime;
import java.util.List;

public record ClaimResponseDto(
        Long id,
        String contactName,
        String contactInfo,
        Claim.ClaimStatus status,
        LocalDateTime createdAt,
        List<String> imageUrls) {
}
