/* Last word on the action table (2026-11-02): every FX_ACTIONS entry defined in any 02* part gets the immunity wrapper here, so a
   new part (02w, 02x ...) never has to remember its own wrapImmunity() call (test LO01 was the reminder). Idempotent: see 02k. */
wrapImmunity(Object.values(FX_ACTIONS));
