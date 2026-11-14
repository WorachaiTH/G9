package com.tu.lostandfound.repository;

import com.tu.lostandfound.model.Post;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface PostRepository extends JpaRepository<Post, Long> {

    List<Post> findByStatus(Post.PostStatus status);
    List<Post> findAllByOrderByCreatedAtDesc();

    List<Post> findByStatusOrderByCreatedAtDesc(Post.PostStatus status);
    List<Post> findByType(Post.PostType type);

    List<Post> findByStatusInOrderByCreatedAtDesc(Collection<Post.PostStatus> statuses);

    @Query("""
            select p from Post p
            where p.status in :statuses
              and (lower(p.title) like :pattern escape '!'
                or lower(p.description) like :pattern escape '!'
                or lower(p.location) like :pattern escape '!')
            order by p.createdAt desc
            """)
    List<Post> searchByKeyword(@Param("pattern") String pattern,
                               @Param("statuses") Collection<Post.PostStatus> statuses);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Post p where p.id = :id")
    Optional<Post> findByIdForUpdate(@Param("id") Long id);

    List<Post> findByStatusAndGrantedAtBefore(Post.PostStatus status, LocalDateTime cutoff);
}
