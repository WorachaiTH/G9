package com.tu.lostandfound.service;

import com.tu.lostandfound.model.Post;
import com.tu.lostandfound.repository.PostRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
public class PostPurgeJob {

    static final int RETENTION_DAYS = 30;

    private static final Logger logger = LoggerFactory.getLogger(PostPurgeJob.class);

    private final PostRepository postRepository;
    private final PostService postService;

    public PostPurgeJob(PostRepository postRepository, PostService postService) {
        this.postRepository = postRepository;
        this.postService = postService;
    }

    @Scheduled(cron = "0 0 3 * * *")
    public void purgeExpired() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(RETENTION_DAYS);
        List<Post> expired = postRepository.findByStatusAndGrantedAtBefore(Post.PostStatus.returned, cutoff);
        for (Post post : expired) {
            try {
                postService.deleteExpired(post.getId());
            } catch (RuntimeException e) {
                logger.warn("Cannot purge post {}: {}", post.getId(), e.getMessage());
            }
        }
    }
}
