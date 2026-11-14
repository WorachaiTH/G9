package com.tu.lostandfound.controller;

import com.tu.lostandfound.dto.ClaimCreateRequestDto;
import com.tu.lostandfound.dto.ClaimResponseDto;
import com.tu.lostandfound.exception.ApiException;
import com.tu.lostandfound.security.JwtService;
import com.tu.lostandfound.service.ClaimService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@CrossOrigin(origins = "*")
public class ClaimController {
    private final ClaimService claimService;
    private final JwtService jwtService;

    public ClaimController(ClaimService claimService, JwtService jwtService) {
        this.claimService = claimService;
        this.jwtService = jwtService;
    }

    @PostMapping(value = "/api/posts/{id}/claims", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ClaimResponseDto> createClaim(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id,
            @RequestPart("req") ClaimCreateRequestDto request,
            @RequestPart(value = "photos", required = false) MultipartFile[] photos) {
        String employeeId = requireEmployeeId(authorization, "กรุณาเข้าสู่ระบบก่อนส่งคำขอ");
        return ResponseEntity.status(HttpStatus.CREATED).body(claimService.create(id, request, photos, employeeId));
    }

    @GetMapping("/api/posts/{id}/claims")
    public List<ClaimResponseDto> getClaims(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long id) {
        return claimService.listForPost(id, requireEmployeeId(authorization, "กรุณาเข้าสู่ระบบก่อนดูคำขอ"));
    }

    @PostMapping("/api/claims/{claimId}/confirm")
    public ResponseEntity<Void> confirmClaim(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long claimId) {
        claimService.confirm(claimId, requireEmployeeId(authorization, "กรุณาเข้าสู่ระบบก่อนยืนยันคำขอ"));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/claims/{claimId}/reject")
    public ResponseEntity<Void> rejectClaim(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long claimId) {
        claimService.reject(claimId, requireEmployeeId(authorization, "กรุณาเข้าสู่ระบบก่อนปฏิเสธคำขอ"));
        return ResponseEntity.noContent().build();
    }

    private String requireEmployeeId(String authorization, String message) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, message);
        }
        String employeeId = jwtService.parseEmployeeId(authorization.substring(7));
        if (employeeId == null) throw new ApiException(HttpStatus.UNAUTHORIZED, message);
        return employeeId;
    }
}
