package com.tu.lostandfound.repository;

import com.tu.lostandfound.model.Post;
import com.tu.lostandfound.model.PostImage;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
class PostImageRepositoryTest {

    @Autowired
    PostRepository postRepo;

    @Autowired
    PostImageRepository imageRepo;

    @Autowired
    EntityManager em;

    private Post savePost(String title) {
        Post p = new Post();
        p.setTitle(title);
        p.setDescription("รายละเอียด " + title);
        p.setLocation("ตึก SC");
        p.setContactInfo("0812345678");
        p.setType(Post.PostType.lost);
        return postRepo.save(p);
    }

    private PostImage saveImage(Post post, String url, int order) {
        PostImage img = new PostImage();
        img.setImageUrl(url);
        img.setMimeType("image/jpeg");
        img.setSizeBytes(1000);
        img.setSortOrder((short) order);
        img.setPost(post);
        return imageRepo.save(img);
    }

    @Test // TC-DAO-06
    void findByPostId_returnsImagesOrderedBySortOrder() {
        Post post = savePost("กระเป๋า");
        saveImage(post, "/uploads/c.jpg", 3);
        saveImage(post, "/uploads/a.jpg", 1);
        saveImage(post, "/uploads/b.jpg", 2);
        em.flush();
        em.clear();

        List<PostImage> result = imageRepo.findByPostIdOrderBySortOrderAsc(post.getId());

        assertEquals(3, result.size());
        assertEquals("/uploads/a.jpg", result.get(0).getImageUrl());
        assertEquals("/uploads/b.jpg", result.get(1).getImageUrl());
        assertEquals("/uploads/c.jpg", result.get(2).getImageUrl());
    }

    @Test // TC-DAO-07
    void findByPostId_returnsOnlyThatPostsImages() {
        Post postA = savePost("A");
        Post postB = savePost("B");
        saveImage(postA, "/uploads/a1.jpg", 1);
        saveImage(postA, "/uploads/a2.jpg", 2);
        saveImage(postB, "/uploads/b1.jpg", 1);
        em.flush();
        em.clear();

        List<PostImage> result = imageRepo.findByPostIdOrderBySortOrderAsc(postA.getId());

        assertEquals(2, result.size());
        assertTrue(result.stream().allMatch(i -> i.getImageUrl().startsWith("/uploads/a")));
    }

    @Test // TC-DAO-08
    void findByPostId_withNoImages_returnsEmptyList() {
        Post post = savePost("ไม่มีรูป");
        em.flush();
        em.clear();

        List<PostImage> result = imageRepo.findByPostIdOrderBySortOrderAsc(post.getId());

        assertTrue(result.isEmpty());
    }

    @Test // TC-DAO-09
    void deleteImagesThenPost_removesBoth() {
        Post post = savePost("ลบทั้งคู่");
        saveImage(post, "/uploads/x.jpg", 1);
        em.flush();
        em.clear();

        List<PostImage> images = imageRepo.findByPostIdOrderBySortOrderAsc(post.getId());
        imageRepo.deleteAll(images);
        imageRepo.flush();
        postRepo.deleteById(post.getId());
        postRepo.flush();

        assertTrue(imageRepo.findByPostIdOrderBySortOrderAsc(post.getId()).isEmpty());
        assertTrue(postRepo.findById(post.getId()).isEmpty());
    }

    @Test // TC-DAO-10
    void deletePostThatStillHasImages_throws() {
        Post post = savePost("ยังมีรูป");
        saveImage(post, "/uploads/y.jpg", 1);
        em.flush();
        em.clear();

        postRepo.deleteById(post.getId());

        assertThrows(DataIntegrityViolationException.class, () -> postRepo.flush());
    }

    @Test // TC-DAO-11
    void saveImageWithoutPost_throws() {
        PostImage img = new PostImage();
        img.setImageUrl("/uploads/z.jpg");
        img.setSortOrder((short) 1);

        assertThrows(DataIntegrityViolationException.class, () -> imageRepo.saveAndFlush(img));
    }
}
