PULL_REQUESTS_QUERY = """
query FetchPullRequests(
  $owner: String!
  $repo:  String!
  $first: Int!
  $after: String
) {
  repository(owner: $owner, name: $repo) {
    pullRequests(
      first: $first
      after: $after
      orderBy: { field: UPDATED_AT, direction: DESC }
      states: [OPEN, CLOSED, MERGED]
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        number
        title
        state
        isDraft
        createdAt
        updatedAt
        mergedAt
        closedAt
        additions
        deletions
        changedFiles

        author { login }

        labels(first: 15) {
          nodes { name }
        }

        files(first: 100) {
          pageInfo { hasNextPage endCursor }
          nodes {
            path
            additions
            deletions
          }
        }

        reactions(first: 100) {
          nodes { content }
        }

        timelineItems(
          first: 100
          itemTypes: [
            PULL_REQUEST_COMMIT
            PULL_REQUEST_REVIEW
            ISSUE_COMMENT
            READY_FOR_REVIEW_EVENT
            CONVERT_TO_DRAFT_EVENT
            REOPENED_EVENT
            CLOSED_EVENT
            MERGED_EVENT
          ]
        ) {
          pageInfo { hasNextPage endCursor }
          nodes {
            __typename

            ... on PullRequestCommit {
              commit {
                oid
                committedDate
                author {
                  user { login }
                  email
                }
              }
            }

            ... on PullRequestReview {
              author { login }
              submittedAt
              state
              body
              comments(first: 1) { totalCount }
              reactions(first: 50) { nodes { content } }
            }

            ... on IssueComment {
              author { login }
              createdAt
              body
              reactions(first: 50) { nodes { content } }
            }

            ... on ReadyForReviewEvent {
              createdAt
              actor { login }
            }

            ... on ConvertToDraftEvent {
              createdAt
              actor { login }
            }

            ... on ReopenedEvent {
              createdAt
              actor { login }
            }

            ... on ClosedEvent {
              createdAt
              actor { login }
            }

            ... on MergedEvent {
              createdAt
              actor { login }
            }
          }
        }

        commits(last: 1) {
          nodes {
            commit {
              checkSuites(first: 10) {
                nodes {
                  checkRuns(first: 30) {
                    nodes {
                      name
                      status
                      conclusion
                      startedAt
                      completedAt
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  rateLimit {
    limit
    remaining
    resetAt
    cost
  }
}
"""

PR_TIMELINE_PAGE_QUERY = """
query FetchPRTimelinePage(
  $owner:  String!
  $repo:   String!
  $number: Int!
  $after:  String!
) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      timelineItems(
        first: 100
        after: $after
        itemTypes: [
          PULL_REQUEST_COMMIT
          PULL_REQUEST_REVIEW
          ISSUE_COMMENT
          READY_FOR_REVIEW_EVENT
          CONVERT_TO_DRAFT_EVENT
          REOPENED_EVENT
          CLOSED_EVENT
          MERGED_EVENT
        ]
      ) {
        pageInfo { hasNextPage endCursor }
        nodes {
          __typename

          ... on PullRequestCommit {
            commit {
              oid
              committedDate
              author {
                user { login }
                email
              }
            }
          }

          ... on PullRequestReview {
            author { login }
            submittedAt
            state
            body
            comments(first: 1) { totalCount }
            reactions(first: 50) { nodes { content } }
          }

          ... on IssueComment {
            author { login }
            createdAt
            body
            reactions(first: 50) { nodes { content } }
          }

          ... on ReadyForReviewEvent {
            createdAt
            actor { login }
          }

          ... on ConvertToDraftEvent {
            createdAt
            actor { login }
          }

          ... on ReopenedEvent {
            createdAt
            actor { login }
          }

          ... on ClosedEvent {
            createdAt
            actor { login }
          }

          ... on MergedEvent {
            createdAt
            actor { login }
          }
        }
      }
    }
  }
}
"""

PR_FILES_PAGE_QUERY = """
query FetchPRFilesPage(
  $owner:  String!
  $repo:   String!
  $number: Int!
  $after:  String!
) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      files(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          path
          additions
          deletions
        }
      }
    }
  }
}
"""

ISSUES_QUERY = """
query FetchIssues(
  $owner: String!
  $repo:  String!
  $first: Int!
  $after: String
) {
  repository(owner: $owner, name: $repo) {
    issues(
      first: $first
      after: $after
      orderBy: { field: UPDATED_AT, direction: DESC }
      states: [OPEN, CLOSED]
    ) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        number
        title
        state
        createdAt
        updatedAt
        closedAt

        author { login }

        labels(first: 15) {
          nodes { name }
        }

        reactions(first: 100) {
          nodes { content }
        }

        timelineItems(
          first: 50
          itemTypes: [
            ISSUE_COMMENT
            REOPENED_EVENT
            CLOSED_EVENT
          ]
        ) {
          pageInfo { hasNextPage endCursor }
          nodes {
            __typename

            ... on IssueComment {
              author { login }
              createdAt
              body
              reactions(first: 50) { nodes { content } }
            }

            ... on ReopenedEvent {
              createdAt
              actor { login }
            }

            ... on ClosedEvent {
              createdAt
              actor { login }
            }
          }
        }
      }
    }
  }

  rateLimit {
    limit
    remaining
    resetAt
    cost
  }
}
"""

RATE_LIMIT_QUERY = """
query RateLimit {
  rateLimit {
    limit
    remaining
    resetAt
    cost
  }
}
"""

REPOSITORY_INFO_QUERY = """
query RepositoryInfo($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    nameWithOwner
    description
    isPrivate
    defaultBranchRef { name }
    stargazerCount
    createdAt
    pushedAt
  }
}
"""
