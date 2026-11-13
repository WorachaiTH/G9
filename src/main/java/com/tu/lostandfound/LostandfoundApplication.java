package com.tu.lostandfound;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class LostandfoundApplication {

	public static void main(String[] args) {
		SpringApplication.run(LostandfoundApplication.class, args);
	}

}
