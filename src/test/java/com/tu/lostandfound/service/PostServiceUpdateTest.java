package com.tu.lostandfound.service;

import com.tu.lostandfound.dto.PostDto;
import com.tu.lostandfound.dto.PostUpdateRequest;
import com.tu.lostandfound.exception.ApiException;
import com.tu.lostandfound.model.Post;
import com.tu.lostandfound.model.PostImage;
import com.tu.lostandfound.repository.PostImageRepository;
import com.tu.lostandfound.repository.PostRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@Import({PostService.class, UploadService.class})
class PostServiceUpdateTest {

    private static final String OWNER = "6501";

    @Autowired
    PostService postService;

    @Autowired
    PostRepository postRepo;

    @Autowired
    PostImageRepository imageRepo;

    @Autowired
    EntityManager em;

    private Post savePost(Post.PostStatus status) {
        Post p = new Post();
        p.setTitle("กระเป๋า");
        p.setDescription("กระเป๋าสีดำ");
        p.setLocation("ตึก SC");
        p.setContactInfo("0812345678");
        p.setType(Post.PostType.found);
        p.setAuthorEmail(OWNER);
        p.setStatus(status);
        return postRepo.save(p);
    }

    private PostImage saveImage(Post post, int order) {
        PostImage img = new PostImage();
        img.setImageUrl("/uploads/img-" + order + ".jpg");
        img.setMimeType("image/jpeg");
        img.setSizeBytes(1000);
        img.setSortOrder((short) order);
        img.setPost(post);
        return imageRepo.save(img);
    }

    private PostUpdateRequest request(String description, String location, String contactInfo) {
        return new PostUpdateRequest("ชื่อใหม่", description, location, "สมชาย", contactInfo, Post.ContactType.phone);
    }

    private HttpStatus statusOf(Runnable action) {
        ApiException e = assertThrows(ApiException.class, action::run);
        return e.getStatus();
    }

    @Test // U9 TC1
    void ownerUpdatesText_savedToDatabase() {
        Post post = savePost(Post.PostStatus.published);
        em.flush();
        em.clear();

        PostDto dto = postService.update(post.getId(), OWNER,
                request("รายละเอียดใหม่", "โรงอาหาร", "0899999999"), null, null);
        em.flush();
        em.clear();

        Post saved = postRepo.findById(post.getId()).orElseThrow();
        assertEquals("ชื่อใหม่", saved.getTitle());
        assertEquals("รายละเอียดใหม่", saved.getDescription());
        assertEquals("โรงอาหาร", saved.getLocation());
        assertEquals("0899999999", saved.getContactInfo());
        assertEquals(Post.ContactType.phone, saved.getContactType());
        assertTrue(dto.mine());
    }

    @Test // U9 TC1 (remove image)
    void ownerRemovesOwnImage_imageGone() {
        Post post = savePost(Post.PostStatus.published);
        PostImage keep = saveImage(post, 1);
        PostImage remove = saveImage(post, 2);
        em.flush();
        em.clear();

        PostDto dto = postService.update(post.getId(), OWNER,
                request("รายละเอียด", "ตึก SC", "0812345678"), null, List.of(remove.getId()));
        em.flush();
        em.clear();

        List<PostImage> left = imageRepo.findByPostIdOrderBySortOrderAsc(post.getId());
        assertEquals(1, left.size());
        assertEquals(keep.getId(), left.get(0).getId());
        assertEquals(1, dto.images().size());
    }

    @Test // U9 TC4
    void blankRequiredField_returns400() {
        Post post = savePost(Post.PostStatus.published);
        em.flush();

        assertEquals(HttpStatus.BAD_REQUEST, statusOf(() -> postService.update(post.getId(), OWNER,
                request("   ", "ตึก SC", "0812345678"), null, null)));
        assertEquals(HttpStatus.BAD_REQUEST, statusOf(() -> postService.update(post.getId(), OWNER,
                request("รายละเอียด", "", "0812345678"), null, null)));
        assertEquals(HttpStatus.BAD_REQUEST, statusOf(() -> postService.update(post.getId(), OWNER,
                request("รายละเอียด", "ตึก SC", null), null, null)));
    }

    @Test // U9 TC5
    void notOwner_returns403() {
        Post post = savePost(Post.PostStatus.published);
        em.flush();

        assertEquals(HttpStatus.FORBIDDEN, statusOf(() -> postService.update(post.getId(), "9999",
                request("รายละเอียด", "ตึก SC", "0812345678"), null, null)));
    }

    @Test
    void postNotFound_returns404() {
        assertEquals(HttpStatus.NOT_FOUND, statusOf(() -> postService.update(999999L, OWNER,
                request("รายละเอียด", "ตึก SC", "0812345678"), null, null)));
    }

    @Test
    void removeImageOfAnotherPost_returns400() {
        Post mine = savePost(Post.PostStatus.published);
        Post other = savePost(Post.PostStatus.published);
        PostImage otherImage = saveImage(other, 1);
        em.flush();
        em.clear();

        assertEquals(HttpStatus.BAD_REQUEST, statusOf(() -> postService.update(mine.getId(), OWNER,
                request("รายละเอียด", "ตึก SC", "0812345678"), null, List.of(otherImage.getId()))));
    }

    @Test
    void claimedOrReturnedPost_returns409() {
        Post claimed = savePost(Post.PostStatus.claimed);
        Post returned = savePost(Post.PostStatus.returned);
        em.flush();

        assertEquals(HttpStatus.CONFLICT, statusOf(() -> postService.update(claimed.getId(), OWNER,
                request("รายละเอียด", "ตึก SC", "0812345678"), null, null)));
        assertEquals(HttpStatus.CONFLICT, statusOf(() -> postService.update(returned.getId(), OWNER,
                request("รายละเอียด", "ตึก SC", "0812345678"), null, null)));
    }
}
