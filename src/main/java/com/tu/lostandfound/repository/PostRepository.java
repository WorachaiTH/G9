package com.tu.lostandfound.repository;

import com.tu.lostandfound.model.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

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
}
