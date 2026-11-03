import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import React from 'react';
import CopyCodeButton from './CopyCodeButton';
import '@/styles/code-theme.css';

const schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      ['rel', 'nofollow ugc noopener noreferrer'],
      ['target', '_blank'],
    ],
    img: [['src'], ['alt'], ['title']],
    code: [['className']], // allow syntax highlight classes
    span: [['className']], // allow syntax highlight classes
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ['https'],
    href: ['https', 'mailto'],
  },
};

interface PostBodyProps {
  content: string;
}

export default function PostBody({ content }: PostBodyProps) {
  if (!content) return null;

  const components: Components = {
    h2: ({ node, ...props }) => {
      const text = String(props.children);
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return <h2 id={id} {...props} />;
    },
    h3: ({ node, ...props }) => {
      const text = String(props.children);
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      return <h3 id={id} {...props} />;
    },
    pre: ({ node, children, ...props }) => {
      // Extract code text from children
      let codeText = '';
      React.Children.forEach(children, (child) => {
        if (React.isValidElement(child) && (child as React.ReactElement<any>).props.children) {
          codeText = String((child as React.ReactElement<any>).props.children);
        }
      });
      return (
        <div className="relative group">
          <CopyCodeButton text={codeText} />
          <pre {...props}>{children}</pre>
        </div>
      );
    }
  };

  return (
    <article className="prose prose-invert max-w-none text-jazz-text leading-relaxed text-base space-y-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, schema], rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
