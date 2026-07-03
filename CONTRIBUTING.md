# Contributing to Reel Studio

Thanks for your interest in contributing to Reel Studio! This is an open-source project, and we welcome contributions from the community.

## Getting Started

### Development Setup

1. **Fork and clone the repository**:
   ```bash
   git clone https://github.com/mohitkale/reel-studio.git
   cd reel-studio
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Copy environment template**:
   ```bash
   cp .env.example .env.local
   ```

4. **Initialize database**:
   ```bash
   npm run db:push
   ```

5. **Optional sample data**:
   ```bash
   npm run seed:demo-brandkit
   npm run seed:assets
   ```

6. **Run the development server**:
   ```bash
   npm run dev
   ```

   Open `http://localhost:3000` to see the application.

## Contribution Guidelines

### Types of Contributions

We welcome the following types of contributions:

- **Bug fixes**: Help us squash bugs and improve stability
- **New features**: Add new capabilities following our architecture
- **Documentation**: Improve docs, add examples, write guides
- **Templates**: Create new scene templates for the video editor
- **Voice providers**: Add support for new TTS/voice services
- **AI providers**: Integrate new AI services for content generation
- **Performance improvements**: Optimize rendering, database queries, or UI
- **Testing**: Add tests to improve code coverage

### Development Workflow

1. **Create a branch** for your contribution:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our code style and architecture patterns

3. **Test your changes**:
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run security:scan
   ```

4. **Commit your changes** with clear, descriptive messages:
   ```bash
   git commit -m "Add: new voice provider for XYZ service"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** to the main repository

### Code Quality Checklist

Before opening a PR, ensure:

- [ ] All tests pass: `npm run test`
- [ ] No linting errors: `npm run lint`
- [ ] No TypeScript errors: `npm run typecheck`
- [ ] No security issues: `npm run security:scan`
- [ ] Code follows existing patterns and style
- [ ] Documentation is updated for any API changes
- [ ] Tests are added for new functionality

### Commit Message Guidelines

Use clear, descriptive commit messages:

- **Add**: New features (e.g., "Add: support for custom Lottie animations")
- **Fix**: Bug fixes (e.g., "Fix: resolve timeline sync issue on scene reorder")
- **Update**: Updates to existing code (e.g., "Update: improve render performance")
- **Refactor**: Code refactoring (e.g., "Refactor: simplify voice provider registry")
- **Docs**: Documentation changes (e.g., "Docs: add API usage examples")

## Security Requirements

**Critical**: Never expose secrets or API keys.

- ❌ Never commit `.env.local` or any environment files with real keys
- ❌ Never hardcode API keys in source files or documentation
- ❌ Never include personal credentials in any code or comments
- ✅ Keep `.env.example` values empty or use placeholder-only values
- ✅ If a secret is accidentally exposed, rotate it immediately and report it

### Local Git Hook (Recommended)

Enable the provided pre-commit hook once per clone:

```bash
npm run prepare:hooks
```

This runs `npm run security:scan` before each commit to catch accidental secret exposure.

## Architecture Guidelines

### Project Structure

- **Voice providers**: Pluggable via `src/providers/voice/`
- **AI providers**: Isolated under `src/providers/ai/`
- **Stock providers**: Image/asset providers in `src/providers/stock/`
- **Render orchestration**: Core logic in `src/library/render-service.ts`
- **Templates**: Scene templates in `src/compositions/templates/`
- **API routes**: All routes should validate inputs with Zod

### Adding New Voice Providers

1. Create a new file in `src/providers/voice/`
2. Implement the `VoiceProvider` interface from `types.ts`
3. Register your provider in `registry.ts`
4. Add tests in `providers.test.ts`
5. Update documentation

### Adding New Templates

1. Create a new template file in `src/compositions/templates/`
2. Follow the existing template structure
3. Register in `templates.ts`
4. Add a preview/thumbnail if possible
5. Document usage and any special requirements

### Adding New AI Providers

1. Create a new file in `src/providers/ai/`
2. Implement the AI provider interface
3. Register in `registry.ts`
4. Add tests
5. Update `.env.example` with any required API keys

## Testing

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch
```

### Writing Tests

- Add tests for new functionality
- Test edge cases and error conditions
- Mock external API calls
- Ensure tests are fast and reliable

## Documentation

### Updating Documentation

- Keep README.md up to date with new features
- Update API documentation for any route changes
- Add examples for complex features
- Document any breaking changes in the PR description

### Code Comments

- Add comments for complex logic
- Document non-obvious decisions
- Keep comments concise and helpful

## Reporting Issues

When reporting bugs, please include:

- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Node version, browser)
- Screenshots or recordings if applicable

## Feature Requests

For feature requests:

- Describe the use case clearly
- Explain why it would be valuable
- Suggest a possible implementation approach
- Consider if it fits the project's scope and goals

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Assume good intentions

## License

By contributing to Reel Studio, you agree that your contributions will be licensed under the MIT License.

## Getting Help

- Open an issue for bugs or questions
- Check existing issues and discussions
- Read the documentation in the `docs/` folder
- Review the AI guidelines in `AI_GUIDELINES.md`

Thank you for contributing to Reel Studio!
