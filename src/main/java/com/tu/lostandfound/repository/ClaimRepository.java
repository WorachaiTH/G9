package com.tu.lostandfound.repository;

import com.tu.lostandfound.model.Claim;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClaimRepository extends JpaRepository<Claim, Long> {
    List<Claim> findByPostIdOrderByCreatedAtDesc(Long postId);
    List<Claim> findByPostId(Long postId);
}
