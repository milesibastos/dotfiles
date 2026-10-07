# tmux Quick Reference

Prefix: C-a                 C-a means Ctrl+a

+---------------------+---------------------+---------------------+
| SESSIONS            | WINDOWS             | PANES               |
+---------------------+---------------------+---------------------+
| tmux new -s NAME    | C-a c   new         | C-a |   split right |
| tmux ls             | C-a C-h previous    | C-a -   split below |
| tmux a -t NAME      | C-a C-l next        | C-a h/j/k/l move    |
| C-a s   picker      | C-a 1..9 select     | C-a H/J/K/L resize  |
| C-a d   detach      | C-a w   choose      | C-a q   show nums   |
| C-a $   rename      | C-a ,   rename      | C-a z   zoom        |
| C-a (/) prev/next   | C-a &   kill        | C-a x   kill        |
+---------------------+---------------------+---------------------+
| COPY / SCROLL       | TOOLS               | GENERAL             |
+---------------------+---------------------+---------------------+
| C-a Esc copy mode   | C-a g   lazygit     | C-a r   reload      |
| h/j/k/l move        | C-a G   lazydocker  | C-a T   status bar  |
| C-u/C-d half page   | C-a y   yazi        | C-a ?   all keys    |
| / or ?  search      | C-a u   AI usage    | mouse   enabled     |
| n/N     next/prev   | C-a s   sessions    | C-a C-a send C-a   |
| v       select      | C-a n   next agent  |                     |
| y       copy        |                     |                     |
| C-a p   paste       |                     |                     |
+---------------------+---------------------+---------------------+

Basics: window = tab | pane = split | detach keeps programs running
