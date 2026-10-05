package com.cypher.gateway.config;

import com.cypher.gateway.model.UserEntity;
import com.cypher.gateway.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;

@Configuration
public class DataInitializer {
    @Bean
    CommandLineRunner seedAdmin(UserRepository users, PasswordEncoder encoder) {
        return args -> {
            if (users.findByEmailIgnoreCase("admin@cypher.local").isEmpty()) {
                UserEntity admin = new UserEntity();
                admin.setEmail("admin@cypher.local");
                admin.setPasswordHash(encoder.encode("changeme"));
                admin.setDisplayName("Cypher Administrator");
                admin.setRole("ADMIN");
                admin.setCreatedAt(Instant.now());
                users.save(admin);
            }
        };
    }
}

