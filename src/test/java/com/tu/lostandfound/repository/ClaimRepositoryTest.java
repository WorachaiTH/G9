package com.tu.lostandfound.repository;

import com.tu.lostandfound.model.Claim;
import com.tu.lostandfound.model.ClaimImage;
import com.tu.lostandfound.model.Post;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
class ClaimRepositoryTest {

    @Autowired
    PostRepository postRepo;

    @Autowired
    ClaimRepository claimRepo;

    @Autowired
    EntityManager em;

    private Post savePost() {
        Post p = new Post();
        p.setTitle("กระเป๋า");
        p.setDescription("กระเป๋าสีดำ");
        p.setLocation("ตึก SC");
        p.setContactInfo("0812345678");
        p.setType(Post.PostType.found);
        return postRepo.save(p);
    }

    private Claim newClaim(Post post, String claimantId, int imageCount) {
        Claim claim = new Claim();
        claim.setPost(post);
        claim.setClaimantId(claimantId);
        claim.setContactName("ผู้ขอรับ " + claimantId);
        claim.setContactInfo("0899999999");
        for (int i = 1; i <= imageCount; i++) {
            ClaimImage image = new ClaimImage();
            image.setImageUrl("/uploads/" + claimantId + "-" + i + ".jpg");
            image.setMimeType("image/jpeg");
            image.setSizeBytes(1000);
            image.setSortOrder((short) i);
            claim.addImage(image);
        }
        return claim;
    }

    private long countClaimImages() {
        return em.createQuery("select count(i) from ClaimImage i", Long.class).getSingleResult();
    }

    @Test // TC-DAO-19
    void save_cascadesImages() {
        Post post = savePost();
        Claim saved = claimRepo.save(newClaim(post, "6501", 2));
        em.flush();
        em.clear();

        Claim found = claimRepo.findById(saved.getId()).orElseThrow();

        assertEquals(Claim.ClaimStatus.pending, found.getStatus());
        assertNotNull(found.getCreatedAt());
        assertEquals(2, found.getImages().size());
        assertEquals("/uploads/6501-1.jpg", found.getImages().get(0).getImageUrl());
    }

    @Test // TC-DAO-20
    void findByPostId_returnsOnlyThatPostsClaims() {
        Post postA = savePost();
        Post postB = savePost();
        claimRepo.save(newClaim(postA, "6501", 1));
        claimRepo.save(newClaim(postA, "6502", 1));
        claimRepo.save(newClaim(postB, "6503", 1));
        em.flush();
        em.clear();

        List<Claim> result = claimRepo.findByPostIdOrderByCreatedAtDesc(postA.getId());

        assertEquals(2, result.size());
        assertTrue(result.stream().allMatch(c -> c.getPost().getId().equals(postA.getId())));
    }

    @Test // TC-DAO-21
    void deleteClaims_removesTheirImagesToo() {
        Post post = savePost();
        claimRepo.save(newClaim(post, "6501", 2));
        em.flush();
        em.clear();

        claimRepo.deleteAll(claimRepo.findByPostIdOrderByCreatedAtDesc(post.getId()));
        em.flush();

        assertTrue(claimRepo.findByPostIdOrderByCreatedAtDesc(post.getId()).isEmpty());
        assertEquals(0, countClaimImages());
    }

    @Test // TC-DAO-22
    void deletePostThatStillHasClaims_throws() {
        Post post = savePost();
        claimRepo.save(newClaim(post, "6501", 1));
        em.flush();
        em.clear();

        postRepo.deleteById(post.getId());

        assertThrows(DataIntegrityViolationException.class, () -> postRepo.flush());
    }

    @Test // TC-DAO-23
    void saveClaimWithoutPost_throws() {
        Claim claim = newClaim(null, "6501", 0);

        assertThrows(DataIntegrityViolationException.class, () -> claimRepo.saveAndFlush(claim));
    }
}
