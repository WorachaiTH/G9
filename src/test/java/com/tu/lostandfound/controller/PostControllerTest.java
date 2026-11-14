package com.tu.lostandfound.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tu.lostandfound.dto.PostResponseDto;
import com.tu.lostandfound.dto.PostUpdateRequestDto;
import com.tu.lostandfound.exception.GlobalExceptionHandler;
import com.tu.lostandfound.model.Post;
import com.tu.lostandfound.security.JwtService;
import com.tu.lostandfound.service.PostService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PostController.class)
@Import(GlobalExceptionHandler.class)
class PostControllerTest {
    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private PostService postService;
    @MockBean private JwtService jwtService;

    @BeforeEach
    void setUp() {
        when(jwtService.parseEmployeeId("valid-token")).thenReturn("6500000001");
    }

    @Test
    void getPostsPassesAllFiltersAndSerializesPostDto() throws Exception {
        when(postService.list(Post.PostStatus.pending_review, Post.PostType.found, "Library", "wallet", "6500000001"))
                .thenReturn(List.of(postDto(12L, true)));

        mockMvc.perform(get("/api/posts")
                        .header("Authorization", "Bearer valid-token")
                        .param("status", "pending_review")
                        .param("type", "found")
                        .param("location", "Library")
                        .param("keyword", "wallet"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(12))
                .andExpect(jsonPath("$[0].type").value("found"))
                .andExpect(jsonPath("$[0].owner").value(true))
                .andExpect(jsonPath("$[0].status").value("pending"))
                .andExpect(jsonPath("$[0].images[0].id").value(91))
                .andExpect(jsonPath("$[0].images[0].imageUrl").value("/uploads/wallet.png"));

        verify(postService).list(Post.PostStatus.pending_review, Post.PostType.found, "Library", "wallet", "6500000001");
    }

    @Test
    void getMyPostsUsesEmployeeIdFromJwt() throws Exception {
        when(postService.mine("6500000001")).thenReturn(List.of(postDto(12L, true)));

        mockMvc.perform(get("/api/posts/mine").header("Authorization", "Bearer valid-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].authorEmail").value("6500000001"));

        verify(postService).mine("6500000001");
    }

    @Test
    void getMyPostsRequiresValidJwt() throws Exception {
        mockMvc.perform(get("/api/posts/mine"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void putPostBindsRequestImagesAndRemovalIds() throws Exception {
        PostUpdateRequestDto request = new PostUpdateRequestDto(
                Post.PostType.lost, "Lost keys", "Lost keys near library", "Library", "Alex", "line-id");
        MockMultipartFile requestPart = new MockMultipartFile("request", "", "application/json",
                objectMapper.writeValueAsBytes(request));
        MockMultipartFile newImage = new MockMultipartFile(
                "newImages", "keys.png", "image/png", new byte[]{1, 2, 3});
        when(postService.update(eq(12L), eq(request), any(), eq(List.of(91L)), eq("6500000001")))
                .thenAnswer(invocation -> {
                    PostUpdateRequestDto updated = invocation.getArgument(1);
                    return new PostResponseDto(12L, updated.type(), updated.title(), "open", "6500000001", true,
                            updated.description(), updated.location(), updated.contactName(), updated.contactInfo(),
                            LocalDateTime.of(2026, 1, 2, 3, 4), List.of());
                });
        MockHttpServletRequestBuilder put = multipart("/api/posts/12")
                .file(requestPart)
                .file(newImage)
                .param("removeImageIds", "91")
                .header("Authorization", "Bearer valid-token")
                .with(req -> { req.setMethod("PUT"); return req; });

        mockMvc.perform(put)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(12))
                .andExpect(jsonPath("$.description").value("Lost keys near library"));

        verify(postService).update(eq(12L), eq(request), any(), eq(List.of(91L)), eq("6500000001"));
    }

    @Test
    void deletePostRequiresJwtAndReturnsNoContent() throws Exception {
        mockMvc.perform(delete("/api/posts/12").header("Authorization", "Bearer valid-token"))
                .andExpect(status().isNoContent());

        verify(postService).delete(12L, "6500000001");
    }

    @Test
    void deletePostRejectsMissingJwt() throws Exception {
        mockMvc.perform(delete("/api/posts/12"))
                .andExpect(status().isUnauthorized());
    }

    private PostResponseDto postDto(Long id, boolean owner) {
        return new PostResponseDto(id, Post.PostType.found, "Wallet", "pending", "6500000001", owner,
                "Black wallet", "Library", "Alex", "line-id", LocalDateTime.of(2026, 1, 2, 3, 4),
                List.of(new PostResponseDto.ImageDto(91L, "/uploads/wallet.png")));
    }
}
