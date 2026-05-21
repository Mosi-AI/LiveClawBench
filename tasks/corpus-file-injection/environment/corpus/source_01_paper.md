# source_id: source_01_paper

# Formal Digest: Fast Inference from Transformers via Speculative Decoding

> Yaniv Leviathan, Matan Kalman, Yossi Matias Proceedings of the 40th International Conference on Machine Learning, PMLR 202:19274-19286, 2023.

Abstract

Inference from large autoregressive models like Transformers is slow - decoding K tokens takes K serial runs of the model. In this work we introduce speculative decoding - an algorithm to sample from autoregressive models faster without any changes to the outputs, by computing several tokens in parallel. At the heart of our approach lie the observations that (1) hard language-modeling tasks often include easier subtasks that can be approximated well by more efficient models, and (2) using speculative execution and a novel sampling method, we can make exact decoding from the large models faster, by running them in parallel on the outputs of the approximation models, potentially generating several tokens concurrently, and without changing the distribution. Our method can accelerate existing off-the-shelf models without retraining or architecture changes. We demonstrate it on T5-XXL and show a 2X-3X acceleration compared to the standard T5X implementation, with identical outputs.


\section{Speculative Decoding}
\subsection{Overview}

Let $M_p$ be the target model, inference from which we're trying to accelerate, and $p(x_t|x_{<t})$ the distribution we get from the model for a prefix $x_{<t}$. Let $M_q$ be a more efficient approximation model for the same task, and denote by $q(x_t|x_{<t})$ the distribution we get from the model for a prefix $x_{<t}$\footnote{
We'll use $p(x)$ to denote $p(x_t|x_{<t})$ whenever the prefix $x_{<t}$ is clear from the context, and similarly for $q(x)$.}. The core idea is to (1) use the more efficient model $M_q$ to generate $\gamma \in \mathbb{Z}^+$ completions (see \cref{sec:optimal_gamma} for how to optimally choose this parameter), then (2) use the target model $M_p$ to evaluate all of the guesses and their respective probabilities from $M_q$ \emph{in parallel}, accepting all those that \emph{can} lead to an identical distribution, and (3) sampling an additional token from an adjusted distribution to fix the first one that was rejected, or to add an additional one if they are all accepted. That way, each parallel run of the target model $M_p$ will produce at least one new token (so the number of serial runs of the target model can never, even in the worst case, be larger than the simple autoregressive method), but it can potentially generate many new tokens, up to $\gamma + 1$, depending on how well $M_q$ approximates $M_p$.

\subsection{Standardized Sampling}
\label{sec:standardized_sampling}
First, note that while there are many methods and parameters of sampling, like argmax, top-k, nucleus, and setting a temperature, and popular implementations usually treat them differently at the logits level, they can all easily be cast into standard sampling from an adjusted probability distribution. For example, argmax sampling is equivalent to zeroing out non-max elements of the distribution and normalizing. We can therefore only deal with standard sampling from a probability distribution, and cast all of the other types of sampling into that framework. Going forward we'll assume that $p(x)$ and $q(x)$ are the distributions from $M_p$ and $M_q$ respectively, adjusted for the sampling method.

\subsection{Speculative Sampling}
\label{sec:speculative_sampling}
To sample $x \sim p(x)$, we instead sample $x \sim q(x)$, keeping it if $q(x) \le p(x)$, and in case $q(x) > p(x)$ we reject the sample with probability $1 - \frac{p(x)}{q(x)}$ and sample $x$ again from an adjusted distribution $p'(x) = norm(max(0, p(x) - q(x)))$ instead. It’s easy to show (see \cref{appendix:correctness}) that for any distributions $p(x)$ and $q(x)$, and $x$ sampled in this way, indeed $x \sim p(x)$.

Given the distribution $q(x)$ obtained from running $M_q$ on a conditioning $prefix$, we can sample a token $x_1 \sim q(x)$. We then calculate the distribution $p(x)$ by running $M_p$ on $prefix$ while in parallel speculatively calculating the distribution of the next token $x_2$ by running $M_p$ on $prefix + [x_1]$. Once both computations complete, we proceed as per above: If $x_1$ is rejected, we discard the computation of $x_2$ and re-sample $x_1$ from an adjusted distribution, and if $x_1$ is accepted, we keep both tokens. \cref{alg:sample_with_approx} generalizes this idea to sample between 1 and $\gamma + 1$ tokens at once.


\newcommand{\COMMENTLLAMA}[1]{{\color{darkgreen} $\triangleright$ {#1}}}

\begin{algorithm}
  \caption{SpeculativeDecodingStep}
  \label{alg:sample_with_approx}
\begin{algorithmic}
  \STATE {\bfseries Inputs:} $M_p, M_q, prefix$.
  \STATE \COMMENTLLAMA{Sample $\gamma$ guesses $x_{1,\ldots,\gamma}$ from $M_q$ autoregressively.}
  \FOR{$i=1$ {\bfseries to} $\gamma$}
    \STATE $q_i(x) \gets M_q(prefix + [x_1, \ldots, x_{i-1}])$
    \STATE $x_i \sim q_i(x)$
  \ENDFOR
  \STATE \COMMENTLLAMA{Run $M_p$ in parallel.}
  \STATE $p_1(x), \ldots, p_{\gamma + 1}(x) \gets$
  \STATE \quad \quad $M_p(prefix), \ldots, M_p(prefix + [x_1, \ldots, x_{\gamma}])$
  \STATE \COMMENTLLAMA{Determine the number of accepted guesses $n$.}
  \STATE $r_1 \sim U(0, 1), \dots, r_\gamma \sim U(0, 1)$
  \STATE $n \gets \min(\{ i - 1 \mid 1 \le i \le \gamma, r_i > \frac{p_i(x)}{q_i(x)} \} \cup \{ \gamma \})$
  \STATE \COMMENTLLAMA{Adjust the distribution from $M_p$ if needed.}
  \STATE $p'(x) \gets p_{n+1}(x)$
  \IF{$n < \gamma$}
    \STATE $p'(x) \gets norm(max(0, p_{n+1}(x) - q_{n+1}(x)))$
  \ENDIF
  \STATE \COMMENTLLAMA{Return one token from $M_p$, and $n$ tokens from $M_q$.}
  \STATE $t \sim p'(x)$
  \STATE {\bfseries return} $prefix + [x_1, \ldots, x_{n}, t]$
\end{algorithmic}
\end{algorithm}

\section{Analysis}

\subsection{Number of Generated Tokens}
\label{sec:num_generated_tokens}
Let's analyze the reduction factor in the number of serial calls to the target model, or equivalently, the expected number of tokens produced by a single run of \cref{alg:sample_with_approx}.

\begin{definition}
\label{def:beta_prefix}
The \emph{acceptance rate $\beta_{x_{<t}}$}, given a prefix $x_{<t}$, is the probability of accepting $x_t \sim q(x_t|x_{<t})$ by speculative sampling, as per \cref{sec:speculative_sampling}\footnote{As before, we'll omit the $x_{<t}$ subscript whenever the prefix is clear from the context.}.
\end{definition}

$E(\beta)$ is then a natural measure of how well $M_q$ approximates $M_p$. If we make the simplifying assumption that the $\beta$s are i.i.d., and denote $\alpha = E(\beta)$, then the number of tokens produced by a single run of \cref{alg:sample_with_approx} is a capped geometric variable, with success probability $1 - \alpha$ and cap $\gamma + 1$, and the expected number of tokens generated by \cref{alg:sample_with_approx} satisfies \cref{eq:expected_num_tokens}. See \cref{fig:alpha_v_tokens}.

\begin{equation}
\label{eq:expected_num_tokens}
E(\#\ generated\ tokens) = \frac{1 - \alpha^{\gamma + 1}}{1 - \alpha}
\end{equation}

\begin{figure}[ht]
\begin{center}
\centerline{\includegraphics[width=\columnwidth]{alpha_v_tokens.pdf}}
\caption{The expected number of tokens generated by \cref{alg:sample_with_approx} as a function of $\alpha$ for various values of $\gamma$.}
\label{fig:alpha_v_tokens}
\end{center}
\vskip -0.2in
\end{figure}

\subsection{Calculating $\alpha$}

We'll now derive a simple formula for calculating $\alpha$ given a prefix and the two models $M_p$ and $M_q$. We start by defining a natural divergence $D_{LK}$:

\begin{definition}
\label{def:dlk}
$D_{LK}(p, q) = \sum_{x}|p(x) - M(x)| = \sum_{x}|q(x) - M(x)|$ where $M(x) = \frac{p(x) + q(x)}{2}$.
\end{definition}

\begin{lemma}
\label{lemma:dlk}
$D_{LK}(p, q) = 1 - \sum_x\min(p(x), q(x))$
\end{lemma}

\begin{proof}
$D_{LK}(p, q) = \sum_{x}|p(x) - M(x)| = \sum_x\frac{|p-q|}{2}= 1 - \sum_x\frac{p + q - |p - q|}{2} = 1 - \sum_x\min(p(x), q(x))$
\end{proof}

From \cref{lemma:dlk} we immediately get the following results:

\begin{corollary}
\label{cor:dlk_properties}
$D_{LK}(p, q)\ \text{is a symmetric divergence in}\ [0, 1].\\
D_{LK}(p, q) = 0 \iff p = q. \\
D_{LK}(p, q) = 1 \iff \text{p and q have disjoint support}.$
\end{corollary}

\begin{theorem}
\label{thm:dlk_beta}
$\beta = 1 - D_{LK}(p, q)$
\end{theorem}
\begin{proof}
$\beta = E_{x \sim q(x)}\left\lbrace
\begin{tabular}{@{}p{0.5cm}p{1.8cm}} 
$1$ & $q(x) \le p(x)$ \\
$\frac{p(x)}{q(x)}$ & $q(x) > p(x)$ \\
\end{tabular}\right. =
E_{x \sim q(x)}\min(1, \frac{p(x)}{q(x)}) =
\sum_x\min(p(x), q(x))$
\end{proof}

Finally we get:

\begin{corollary}
\label{thm:dlk_alpha}
$\alpha = 1 - E(D_{LK}(p, q)) = E(\min(p, q))$
\end{corollary}

See \cref{tbl:empirical alphas} for empirically observed $\alpha$ values in our experiments.
