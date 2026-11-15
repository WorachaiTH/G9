package com.tu.lostandfound.controller;

import com.tu.lostandfound.dto.ClaimDto;
import com.tu.lostandfound.dto.ClaimRequest;
import com.tu.lostandfound.dto.PostDto;
import com.tu.lostandfound.security.JwtService;
import com.tu.lostandfound.service.ClaimService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ClaimController {

    private static final String LOGIN_MESSAGE = "กรุณาเข้าสู่ระบบใหม่";

    private final ClaimService claimService;
    private final JwtService jwtService;

    public ClaimController(ClaimService claimService, JwtService jwtService) {
        this.claimService = claimService;
        this.jwtService = jwtService;
    }

    @PostMapping(value = "/posts/{postId}/claims", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ClaimDto> submitClaim(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long postId,
            @RequestPart(value = "claim", required = false) ClaimRequest request,
            @RequestPart(value = "photos", required = false) MultipartFile[] photos) {

        String employeeId = jwtService.requireEmployeeId(authorization, LOGIN_MESSAGE);
        ClaimDto claim = claimService.submit(postId, employeeId, request, photos);
        return ResponseEntity.status(HttpStatus.CREATED).body(claim);
    }

    @GetMapping("/posts/{postId}/claims")
    public List<ClaimDto> listClaims(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long postId) {

        String employeeId = jwtService.requireEmployeeId(authorization, LOGIN_MESSAGE);
        return claimService.listForOwner(postId, employeeId);
    }

    @PostMapping("/claims/{claimId}/confirm")
    public PostDto confirmClaim(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long claimId) {

        String employeeId = jwtService.requireEmployeeId(authorization, LOGIN_MESSAGE);
        return claimService.confirm(claimId, employeeId);
    }

    @PostMapping("/claims/{claimId}/reject")
    public ClaimDto rejectClaim(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable Long claimId) {

        String employeeId = jwtService.requireEmployeeId(authorization, LOGIN_MESSAGE);
        return claimService.reject(claimId, employeeId);
    }
}
