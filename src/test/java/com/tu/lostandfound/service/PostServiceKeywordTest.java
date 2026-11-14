package com.tu.lostandfound.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PostServiceKeywordTest {

    @Test
    void nullOrBlank_returnsNull() {
        assertNull(PostService.normalizeKeyword(null));
        assertNull(PostService.normalizeKeyword(""));
        assertNull(PostService.normalizeKeyword("   \t  "));
    }

    @Test
    void trimsAndCollapsesSpaces() {
        assertEquals("กระเป๋า สีดำ", PostService.normalizeKeyword("  กระเป๋า    สีดำ  "));
    }

    @Test
    void lowercases() {
        assertEquals("iphone", PostService.normalizeKeyword("iPHONE"));
    }

    @Test
    void escapesLikeWildcards() {
        assertEquals("50!% off!_x!!", PostService.normalizeKeyword("50% off_x!"));
    }

    @Test
    void cutsToMaxLength() {
        String longText = "a".repeat(500);
        assertEquals(PostService.MAX_KEYWORD_LENGTH, PostService.normalizeKeyword(longText).length());
    }
}
