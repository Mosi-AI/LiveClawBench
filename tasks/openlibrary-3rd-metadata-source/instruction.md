# BookWorm: please add a third source for book metadata

You are working in the Open Library repository, checked out at the commit
immediately before the upstream change landed. The repository root is
`/workspace/repo`.

A librarian filed the following request:

> Today when Open Library imports a book through BookWorm, the metadata
> pipeline tries Amazon first and falls back to ISBNdb. That's good but
> there are titles neither of those services has — especially older, niche,
> or non-English books. Could BookWorm also try Google Books as a metadata
> source? I'd want to use it for books missing from the first two.

Your task:

1. Read the existing two-source pipeline and understand how a record flows
   from raw input → resolved metadata → import.
2. Add Google Books as a third metadata source for BookWorm.
3. Books that the existing two sources already resolve must continue to
   resolve the same way — the new source must not interfere.
4. Add tests covering the new source and the case where only the new source
   has data.
5. Do not regress existing tests.

The verifier will run the BookWorm test suite plus the metadata pipeline
tests. All must pass.

Constraints the grader enforces:

- Adding a third hard-coded `if google_books: …` branch alongside the two
  existing ones will be detected and rejected. The pipeline should be able
  to accept an arbitrary list of metadata sources, with each source self-
  describing how it resolves a record. The new source must be one entry in
  that list, not a third special case.
- Tests must reference the resolver abstraction (not just call the Google
  Books client directly and assert on its raw response). Tautological tests
  will be rejected.
- A fix that breaks any of the pre-existing source's tests will receive a
  significant penalty even if the new source's tests pass.

You do not need to update documentation unless required to keep the
project's existing self-tests passing.
