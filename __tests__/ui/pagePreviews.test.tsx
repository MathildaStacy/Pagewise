import ReactTestRenderer,{act} from 'react-test-renderer';
import { SkinProvider } from '@ui/kit';
import { pagePreviews } from '@features/gallery/PagePreviews';

it.each(['paper','glass'] as const)('renders every page example in the %s skin',async skinId=>{
  for(const page of Object.values(pagePreviews)) {
    for(const state of page.states) {
      let r!:ReactTestRenderer.ReactTestRenderer;
      await act(async()=>{r=ReactTestRenderer.create(<SkinProvider skinId={skinId} scheme="light" reduceMotion>{page.render(state)}</SkinProvider>);});
      expect(r.toJSON()).not.toBeNull();
      await act(async()=>r.unmount());
    }
  }
});
