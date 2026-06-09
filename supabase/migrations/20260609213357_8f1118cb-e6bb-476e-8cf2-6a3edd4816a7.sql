-- Function to convert string to InitCap (First letter capitalized, others lowercase)
-- We use a simple regex-based approach for each word
CREATE OR REPLACE FUNCTION public.initcap_title(input text) RETURNS text AS $$
DECLARE
    result text;
BEGIN
    -- This handles basic spacing. 
    -- For more complex cases (like acronyms) it might need adjustment, 
    -- but for standard titles this is the convention requested.
    SELECT string_agg(initcap(word), ' ')
    INTO result
    FROM unnest(string_to_array(input, ' ')) AS word;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update existing songs
UPDATE public.songs
SET title = public.initcap_title(title);

-- Drop the temporary function if not needed anymore, 
-- but maybe it's useful for future triggers? 
-- Let's keep it for now but I'll update the titles.
DROP FUNCTION public.initcap_title(text);
