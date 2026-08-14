begin;

select plan(4);

select is(
  to_regprocedure('public.insert_yarn_with_limit(text,text,text,text,integer,integer)'),
  null::regprocedure,
  'legacy yarn insert RPC with scalar materials is absent'
);

select is(
  to_regprocedure('public.insert_yarn_with_limit(text,text,text[],text,integer,integer)'),
  null::regprocedure,
  'legacy yarn insert RPC with material array is absent'
);

select is(
  to_regprocedure('public.get_yarn_store_version()') is not null,
  true,
  'versioned yarn read RPC remains available'
);

select is(
  has_table_privilege('authenticated', 'public.yarns', 'INSERT'),
  false,
  'authenticated cannot bypass the versioned yarn RPC through table INSERT'
);

select * from finish();
rollback;
