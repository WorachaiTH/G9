package com.tu.lostandfound.repository;

import com.tu.lostandfound.model.Post;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
class PostSearchRepositoryTest {

    private static final Set<Post.PostStatus> PUBLIC = Set.of(
            Post.PostStatus.pending_review, Post.PostStatus.published, Post.PostStatus.claimed);

    @Autowired
    PostRepository repo;

    @Autowired
    EntityManager em;

    private Post savePost(String title, String description, String location, Post.PostStatus status) {
        Post p = new Post();
        p.setTitle(title);
        p.setDescription(description);
        p.setLocation(location);
        p.setContactInfo("0812345678");
        p.setType(Post.PostType.found);
        p.setStatus(status);
        return repo.save(p);
    }

    @Test // TC-DAO-12
    void searchByKeyword_matchesTitleDescriptionOrLocation() {
        savePost("กระเป๋าสตางค์สีดำ", "ลืมไว้", "ตึก SC", Post.PostStatus.published);
        savePost("กุญแจ", "มีพวงกุญแจกระเป๋า", "โรงอาหาร", Post.PostStatus.published);
        savePost("ร่ม", "ร่มสีฟ้า", "หน้ากระเป๋าตึก", Post.PostStatus.published);
        savePost("โทรศัพท์", "iPhone", "หอสมุด", Post.PostStatus.published);
        em.flush();

        List<Post> result = repo.searchByKeyword("%กระเป๋า%", PUBLIC);

        assertEquals(3, result.size());
    }

    @Test // TC-DAO-13
    void searchByKeyword_isCaseInsensitive() {
        savePost("iPhone 15", "สีดำ", "ตึก SC", Post.PostStatus.published);
        em.flush();

        List<Post> result = repo.searchByKeyword("%iphone%", PUBLIC);

        assertEquals(1, result.size());
    }

    @Test // TC-DAO-14
    void searchByKeyword_noMatch_returnsEmptyList() {
        savePost("กุญแจ", "พวงกุญแจ", "ตึก SC", Post.PostStatus.published);
        em.flush();

        List<Post> result = repo.searchByKeyword("%ไม่มีคำนี้แน่นอน%", PUBLIC);

        assertTrue(result.isEmpty());
    }

    @Test // TC-DAO-15
    void searchByKeyword_escapedPercent_matchesLiteralPercent() {
        savePost("ลดราคา 50% ที่ร้าน", "บัตรส่วนลด", "ตึก SC", Post.PostStatus.published);
        savePost("ลดราคา 50 บาท", "บัตรส่วนลด", "ตึก SC", Post.PostStatus.published);
        em.flush();

        List<Post> result = repo.searchByKeyword("%50!%%", PUBLIC);

        assertEquals(1, result.size());
        assertEquals("ลดราคา 50% ที่ร้าน", result.get(0).getTitle());
    }

    @Test // TC-DAO-16
    void searchByKeyword_excludesReturnedPosts() {
        savePost("กระเป๋า A", "รายละเอียด", "ตึก SC", Post.PostStatus.published);
        savePost("กระเป๋า B", "รายละเอียด", "ตึก SC", Post.PostStatus.returned);
        em.flush();

        List<Post> result = repo.searchByKeyword("%กระเป๋า%", PUBLIC);

        assertEquals(1, result.size());
        assertEquals("กระเป๋า A", result.get(0).getTitle());
    }

    @Test // TC-DAO-17
    void findByStatusIn_excludesReturnedPosts() {
        savePost("A", "รายละเอียด", "ตึก SC", Post.PostStatus.published);
        savePost("B", "รายละเอียด", "ตึก SC", Post.PostStatus.claimed);
        savePost("C", "รายละเอียด", "ตึก SC", Post.PostStatus.returned);
        em.flush();

        List<Post> result = repo.findByStatusInOrderByCreatedAtDesc(PUBLIC);

        assertEquals(2, result.size());
        assertTrue(result.stream().noneMatch(p -> p.getStatus() == Post.PostStatus.returned));
    }
}
