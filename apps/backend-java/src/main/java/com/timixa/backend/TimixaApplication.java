package com.timixa.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class TimixaApplication {
    public static void main(String[] args) {
        SpringApplication.run(TimixaApplication.class, args);
    }
}
