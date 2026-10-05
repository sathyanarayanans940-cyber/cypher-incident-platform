package com.cypher.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CypherGatewayApplication {
    public static void main(String[] args) {
        SpringApplication.run(CypherGatewayApplication.class, args);
    }
}

