package com.tu.lostandfound.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tu.lostandfound.dto.PostDto;
import com.tu.lostandfound.dto.PostUpdateRequest;
import com.tu.lostandfound.exception.ApiException;
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
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
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
        when(jwtService.employeeIdFromHeader("Bearer valid-token")).thenReturn("6500000001");
        when(jwtService.requireEmployeeId(eq("Bearer valid-token"), anyString())).thenReturn("6500000001");
        when(jwtService.requireEmployeeId(isNull(), anyString()))
                .thenThrow(new ApiException(HttpStatus.UNAUTHORIZED, "unauthorized"));
    }

    @Test
    void getPostsPassesSearchFiltersAndSerializesPostDto() throws Exception {
        when(postService.search("wallet", Post.PostStatus.pending_review, "6500000001"))
                .thenReturn(List.of(postDto(12L, true)));
        mockMvc.perform(get("/api/posts").header("Authorization", "Bearer valid-token")
                        .param("q", "wallet").param("status", "pending_review"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(12))
                .andExpect(jsonPath("$[0].type").value("found"))
                .andExpect(jsonPath("$[0].mine").value(true))
                .andExpect(jsonPath("$[0].images[0].imageUrl").value("/uploads/wallet.png"));
        verify(postService).search("wallet", Post.PostStatus.pending_review, "6500000001");
    }

    @Test
    void getMyPostsPassesJwtAndFilters() throws Exception {
        when(postService.listMine("6500000001", "wallet", Post.PostStatus.published))
                .thenReturn(List.of(postDto(12L, true)));
        mockMvc.perform(get("/api/posts/mine").header("Authorization", "Bearer valid-token")
                        .param("q", "wallet").param("status", "published"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(12));
        verify(postService).listMine("6500000001", "wallet", Post.PostStatus.published);
    }

    @Test
    void getMyPostsRequiresValidJwt() throws Exception {
        mockMvc.perform(get("/api/posts/mine")).andExpect(status().isUnauthorized());
    }

    @Test
    void putPostBindsRequestImagesAndRemovalIds() throws Exception {
        PostUpdateRequest request = new PostUpdateRequest("Lost keys", "Lost keys near library", "Library",
                "Alex", "line-id", Post.ContactType.line);
        MockMultipartFile part = new MockMultipartFile("post", "", "application/json", objectMapper.writeValueAsBytes(request));
        MockMultipartFile image = new MockMultipartFile("newImages", "keys.png", "image/png", new byte[]{1, 2, 3});
        when(postService.update(eq(12L), eq("6500000001"), eq(request), any(), eq(List.of(91L))))
                .thenReturn(postDto(12L, true));
        MockHttpServletRequestBuilder put = multipart("/api/posts/12").file(part).file(image)
                .param("removeImageIds", "91").header("Authorization", "Bearer valid-token")
                .with(req -> { req.setMethod("PUT"); return req; });
        mockMvc.perform(put).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(12));
        verify(postService).update(eq(12L), eq("6500000001"), eq(request), any(), eq(List.of(91L)));
    }

    @Test
    void deletePostRequiresJwtAndReturnsNoContent() throws Exception {
        mockMvc.perform(delete("/api/posts/12").header("Authorization", "Bearer valid-token"))
                .andExpect(status().isNoContent());
        verify(postService).delete(12L, "6500000001");
    }

    @Test
    void deletePostRejectsMissingJwt() throws Exception {
        mockMvc.perform(delete("/api/posts/12")).andExpect(status().isUnauthorized());
    }

    private PostDto postDto(Long id, boolean mine) {
        return new PostDto(id, Post.PostType.found, "Wallet", "Black wallet", "Library",
                LocalDateTime.of(2026, 1, 2, 3, 4), "Alex", "line-id", Post.ContactType.line,
                Post.PostStatus.published, LocalDateTime.of(2026, 1, 2, 3, 4), null, null,
                List.of(new PostDto.ImageDto(91L, "/uploads/wallet.png")), mine);
    }
}
