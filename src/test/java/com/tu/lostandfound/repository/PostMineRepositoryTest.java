package com.tu.lostandfound.repository;

import com.tu.lostandfound.model.Post;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
class PostMineRepositoryTest {

    private static final String ME = "6501";
    private static final String OTHER = "6502";

    @Autowired
    PostRepository repo;

    @Autowired
    EntityManager em;

    private Post savePost(String author, String title, Post.PostStatus status, int daysAgo) {
        Post p = new Post();
        p.setTitle(title);
        p.setDescription("รายละเอียด " + title);
        p.setLocation("ตึก SC");
        p.setContactInfo("0812345678");
        p.setType(Post.PostType.found);
        p.setAuthorEmail(author);
        p.setStatus(status);
        Post saved = repo.save(p);
        em.flush();
        saved.setCreatedAt(LocalDateTime.now().minusDays(daysAgo));
        return saved;
    }

    private void persistDates() {
        em.createQuery("select p from Post p", Post.class).getResultList()
                .forEach(p -> em.createNativeQuery("update posts set created_at = ?1 where id = ?2")
                        .setParameter(1, p.getCreatedAt())
                        .setParameter(2, p.getId())
                        .executeUpdate());
        em.clear();
    }

    @Test // TC-DAO-24 (U10 TC1, TC2)
    void findMine_returnsOnlyMyPostsNewestFirst_includingReturned() {
        savePost(ME, "เก่า", Post.PostStatus.returned, 3);
        savePost(ME, "ใหม่", Post.PostStatus.published, 1);
        savePost(OTHER, "ของคนอื่น", Post.PostStatus.published, 0);
        persistDates();

        List<Post> result = repo.findMine(ME, null, null);

        assertEquals(2, result.size());
        assertEquals("ใหม่", result.get(0).getTitle());
        assertEquals("เก่า", result.get(1).getTitle());
    }

    @Test // TC-DAO-25 (U10 TC3)
    void findMine_withKeyword_filtersMyPosts() {
        savePost(ME, "กระเป๋าสีดำ", Post.PostStatus.published, 1);
        savePost(ME, "กุญแจ", Post.PostStatus.published, 2);
        savePost(OTHER, "กระเป๋าคนอื่น", Post.PostStatus.published, 0);
        persistDates();

        List<Post> result = repo.findMine(ME, "%กระเป๋า%", null);

        assertEquals(1, result.size());
        assertEquals("กระเป๋าสีดำ", result.get(0).getTitle());
    }

    @Test // TC-DAO-26 (U10 TC3)
    void findMine_withStatus_filtersMyPosts() {
        savePost(ME, "A", Post.PostStatus.published, 1);
        savePost(ME, "B", Post.PostStatus.returned, 2);
        persistDates();

        List<Post> result = repo.findMine(ME, null, Post.PostStatus.returned);

        assertEquals(1, result.size());
        assertEquals("B", result.get(0).getTitle());
    }

    @Test // TC-DAO-27 (U10 TC4)
    void findMine_userWithNoPosts_returnsEmptyList() {
        savePost(OTHER, "ของคนอื่น", Post.PostStatus.published, 0);
        persistDates();

        assertTrue(repo.findMine(ME, null, null).isEmpty());
    }

    @Test // TC-DAO-28 (U10 TC5)
    void findMine_noMatch_returnsEmptyList() {
        savePost(ME, "กุญแจ", Post.PostStatus.published, 0);
        persistDates();

        assertTrue(repo.findMine(ME, "%ไม่มีคำนี้%", null).isEmpty());
        assertTrue(repo.findMine(ME, null, Post.PostStatus.claimed).isEmpty());
    }
}
