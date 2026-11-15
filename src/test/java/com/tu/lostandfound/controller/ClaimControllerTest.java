package com.tu.lostandfound.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tu.lostandfound.dto.ClaimDto;
import com.tu.lostandfound.dto.ClaimRequest;
import com.tu.lostandfound.dto.PostDto;
import com.tu.lostandfound.exception.ApiException;
import com.tu.lostandfound.exception.GlobalExceptionHandler;
import com.tu.lostandfound.model.Claim;
import com.tu.lostandfound.model.Post;
import com.tu.lostandfound.security.JwtService;
import com.tu.lostandfound.service.ClaimService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ClaimController.class)
@Import(GlobalExceptionHandler.class)
class ClaimControllerTest {
    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private ClaimService claimService;
    @MockBean private JwtService jwtService;

    @BeforeEach
    void setUp() {
        when(jwtService.requireEmployeeId(eq("Bearer valid-token"), anyString())).thenReturn("6500000001");
        when(jwtService.requireEmployeeId(isNull(), anyString()))
                .thenThrow(new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized"));
    }

    @Test
    void submitClaimBindsRequestAndPhotos() throws Exception {
        ClaimRequest request = new ClaimRequest("Alex", "line-id");
        MockMultipartFile part = new MockMultipartFile("claim", "", "application/json", objectMapper.writeValueAsBytes(request));
        MockMultipartFile photo = new MockMultipartFile("photos", "proof.webp", "image/webp", new byte[]{1, 2, 3});
        when(claimService.submit(eq(12L), eq("6500000001"), eq(request), any())).thenReturn(claimDto(44L));
        mockMvc.perform(multipart("/api/posts/12/claims").file(part).file(photo).header("Authorization", "Bearer valid-token"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.id").value(44))
                .andExpect(jsonPath("$.contactName").value("Alex"))
                .andExpect(jsonPath("$.imageUrls[0]").value("/uploads/proof.webp"));
        verify(claimService).submit(eq(12L), eq("6500000001"), eq(request), any());
    }

    @Test
    void listClaimsReturnsDtos() throws Exception {
        when(claimService.listForOwner(12L, "6500000001")).thenReturn(List.of(claimDto(44L)));
        mockMvc.perform(get("/api/posts/12/claims").header("Authorization", "Bearer valid-token"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(44))
                .andExpect(jsonPath("$[0].postId").value(12))
                .andExpect(jsonPath("$[0].imageUrls[0]").value("/uploads/proof.webp"));
        verify(claimService).listForOwner(12L, "6500000001");
    }

    @Test
    void confirmClaimReturnsPostDto() throws Exception {
        when(claimService.confirm(44L, "6500000001")).thenReturn(postDto());
        mockMvc.perform(post("/api/claims/44/confirm").header("Authorization", "Bearer valid-token"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(12));
        verify(claimService).confirm(44L, "6500000001");
    }

    @Test
    void rejectClaimReturnsClaimDto() throws Exception {
        when(claimService.reject(44L, "6500000001")).thenReturn(claimDto(44L));
        mockMvc.perform(post("/api/claims/44/reject").header("Authorization", "Bearer valid-token"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(44));
        verify(claimService).reject(44L, "6500000001");
    }

    @Test
    void claimEndpointsRejectMissingJwt() throws Exception {
        mockMvc.perform(get("/api/posts/12/claims")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/claims/44/confirm")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/claims/44/reject")).andExpect(status().isUnauthorized());
    }

    private ClaimDto claimDto(Long id) {
        return new ClaimDto(id, 12L, "6500000002", "Alex", "line-id", Claim.ClaimStatus.pending,
                LocalDateTime.of(2026, 1, 2, 3, 4), List.of("/uploads/proof.webp"));
    }

    private PostDto postDto() {
        return new PostDto(12L, Post.PostType.found, "Wallet", "Black wallet", "Library", null,
                "Alex", "line-id", Post.ContactType.line, Post.PostStatus.returned, null, null, null, List.of(), false);
    }
}
