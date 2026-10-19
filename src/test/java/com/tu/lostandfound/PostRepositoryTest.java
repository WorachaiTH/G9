package com.tu.lostandfound.repository;

import com.tu.lostandfound.model.Post;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
class PostRepositoryTest {

    @Autowired
    PostRepository repo;

    private Post newPost(String title, Post.PostType type) {
        Post p = new Post();
        p.setTitle(title);
        p.setDescription("รายละเอียด " + title);
        p.setLocation("ตึก SC");
        p.setContactInfo("0812345678");
        p.setType(type);
        return p;
    }

    @Test // TC-DAO-01
    void save_returnsEntityWithId() {
        Post saved = repo.save(newPost("กระเป๋าสีดำ", Post.PostType.found));
        assertNotNull(saved.getId());
    }

    @Test // TC-DAO-02
    void findById_returnsSameData() {
        Post saved = repo.save(newPost("ร่มสีฟ้า", Post.PostType.lost));
        Post found = repo.findById(saved.getId()).orElseThrow();
        assertEquals("ร่มสีฟ้า", found.getTitle());
        assertEquals("รายละเอียด ร่มสีฟ้า", found.getDescription());
    }

    @Test // TC-DAO-03 (เปลี่ยน NEWS เป็น found)
    void findByType_returnsOnlyThatType() {
        repo.save(newPost("A", Post.PostType.found));
        repo.save(newPost("B", Post.PostType.lost));
        repo.save(newPost("C", Post.PostType.found));
        List<Post> result = repo.findByType(Post.PostType.found);
        assertEquals(2, result.size());
        assertTrue(result.stream().allMatch(p -> p.getType() == Post.PostType.found));
    }

    @Test // TC-DAO-04
    void deleteById_removesPost() {
        Post saved = repo.save(newPost("กุญแจ", Post.PostType.lost));
        repo.deleteById(saved.getId());
        assertEquals(Optional.empty(), repo.findById(saved.getId()));
    }

    @Test // TC-DAO-05
    void save_withNullTitle_throws() {
        Post p = newPost(null, Post.PostType.lost);
        assertThrows(DataIntegrityViolationException.class, () -> repo.saveAndFlush(p));
    }
}