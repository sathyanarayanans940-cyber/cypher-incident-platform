pipeline {
  agent any

  options { timestamps() }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }
    stage('Validate') {
      steps {
        sh 'docker compose config -q'
        sh 'docker compose build gateway ai-engine reporting frontend'
      }
    }
    stage('Deploy mesh') {
      when { branch 'main' }
      steps {
        sh 'docker compose up -d --remove-orphans'
      }
    }
    stage('Smoke test') {
      steps {
        sh 'docker compose ps'
        sh 'curl --fail --retry 10 --retry-delay 3 http://localhost:8081/actuator/health'
        sh 'curl --fail --retry 10 --retry-delay 3 http://localhost:5000/health'
        sh 'curl --fail --retry 10 --retry-delay 3 http://localhost:5001/health'
      }
    }
  }
}
