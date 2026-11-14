package com.tu.lostandfound.repository;

import com.tu.lostandfound.model.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

@Repository
public interface PostRepository extends JpaRepository<Post, Long> {
    
    List<Post> findByStatus(Post.PostStatus status);
    List<Post> findAllByOrderByCreatedAtDesc();

    List<Post> findByStatusOrderByCreatedAtDesc(Post.PostStatus status);
    List<Post> findByType(Post.PostType type);

    List<Post> findByAuthorEmailOrderByCreatedAtDesc(String authorEmail);

    @Query("select p from Post p where " +
            "(:status is null or p.status = :status) and " +
            "(:type is null or p.type = :type) and " +
            "(:location is null or lower(coalesce(p.location, '')) like lower(concat('%', :location, '%'))) and " +
            "(:keyword is null or lower(p.title) like lower(concat('%', :keyword, '%')) or " +
            "lower(p.description) like lower(concat('%', :keyword, '%')) or " +
            "lower(coalesce(p.location, '')) like lower(concat('%', :keyword, '%')) or " +
            "lower(coalesce(p.contactName, '')) like lower(concat('%', :keyword, '%')))")
    List<Post> search(@Param("status") Post.PostStatus status,
                      @Param("type") Post.PostType type,
                      @Param("location") String location,
                      @Param("keyword") String keyword);
}
