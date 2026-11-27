// A ticket waits when it plans to touch a file that an active ticket also touches.
export const conflictsWith = (files, activeTickets) =>
  activeTickets.filter((ticket) => ticket.files.some((file) => files.includes(file))).map((ticket) => ticket.number);

// Splits planned tickets into those that can run together and those that must wait.
export const schedule = (planned, maxParallel) =>
  planned.reduce(
    (state, ticket) => {
      const blockers = conflictsWith(ticket.files, state.run);
      const full = state.run.length >= maxParallel;
      return blockers.length > 0 || full
        ? { ...state, wait: [...state.wait, { ...ticket, waitingFor: blockers }] }
        : { ...state, run: [...state.run, ticket] };
    },
    { run: [], wait: [] },
  );
